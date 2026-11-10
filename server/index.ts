import express from "express";
import multer from "multer";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BACKLOG_DIR, manifest, replay, results, runBatch } from "./backlog.ts";
import { endCall, getSession, handleCallerTurn, startCall } from "./call.ts";
import { DATA_DIR, env, ROOT } from "./env.ts";
import { buildKeyterms, LOCALITIES, STT_TOPIC, ZONES } from "./gazetteer.ts";
import { GnaniError, readTts, synthesize, transcribe } from "./gnani.ts";
import { llmEnabled } from "./llm.ts";
import { display, lines, TTS_LANG, langFromCode } from "./script.ts";
import { store } from "./store.ts";

const app = express();
app.use(express.json({ limit: "1mb" }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });

const REC_DIR = path.join(DATA_DIR, "recordings");
mkdirSync(REC_DIR, { recursive: true });

const KEYTERMS = buildKeyterms();
const VOICE = "Kalpana";
const PUBLIC = process.env.PUBLIC_DEMO === "1";

// ------------------------------------------------------------- per-visitor limits (public demo)
// Protects the programme credits when the demo is hosted: fixed windows per IP and route group.
const buckets = new Map<string, { n: number; reset: number }>();
function limit(group: string, max: number, windowMs: number): express.RequestHandler {
  return (req, res, next) => {
    if (!PUBLIC) return next();
    const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "?").split(",")[0].trim();
    const key = `${group}:${ip}`;
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.reset < now) buckets.set(key, { n: 1, reset: now + windowMs });
    else if (++b.n > max) {
      res.set("Retry-After", String(Math.ceil((b.reset - now) / 1000)));
      return void res.status(429).json({ error: `Demo limit reached for this visitor. Try again in ${Math.ceil((b.reset - now) / 60000)} min.` });
    }
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60_000).unref();

async function speak(text: string, lang: string) {
  const r = await synthesize(text, { voice: VOICE, language: lang });
  return { url: `/api/tts/${r.key}.wav`, ttsMs: r.ms, cached: r.cached };
}

const wrap =
  (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response) =>
    fn(req, res).catch((err: unknown) => {
      const status = err instanceof GnaniError ? (err.status === 429 ? 429 : 502) : 500;
      const detail = err instanceof GnaniError ? err.body : String((err as Error)?.message ?? err);
      console.error("[api]", req.method, req.path, detail);
      if (!res.headersSent) res.status(status).json({ error: detail });
    });

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, gnaniKey: Boolean(env.gnaniKey), llm: llmEnabled(), keyterms: KEYTERMS.length, voice: VOICE, publicDemo: PUBLIC, models: { stt: "prisma-v3.0", tts: "timbre-v3.0" } });
});

app.get("/api/meta", (_req, res) => {
  res.json({
    localities: LOCALITIES.map(({ id, en, ta, lat, lng, zone, floodProne }) => ({ id, en, ta, lat, lng, zone, floodProne })),
    zones: ZONES,
    keyterms: KEYTERMS,
    topic: STT_TOPIC,
    llm: llmEnabled(),
  });
});

app.get("/api/events", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  res.write(`event: hello\ndata: ${JSON.stringify({ tickets: store.list() })}\n\n`);
  store.subscribe(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 20000);
  req.on("close", () => clearInterval(ping));
});

app.get("/api/tickets", (_req, res) => res.json(store.list()));

app.patch("/api/tickets/:id", (req, res) => {
  const t = store.tickets.get(req.params.id);
  if (!t) return void res.status(404).json({ error: "not found" });
  const status = req.body?.status;
  if (["open", "dispatched", "resolved"].includes(status)) t.status = status;
  store.upsert(t);
  res.json(t);
});

/** Officer export: the open queue as CSV, in the same order as the board. */
app.get("/api/tickets.csv", (_req, res) => {
  const cols = ["id", "priority", "status", "source", "locality", "locality_ta", "zone", "landmark", "lat", "lng", "water_level", "people", "vulnerable", "hazards", "needs", "rules", "language", "created_ist", "caller_synthetic", "transcript"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const rows = store.list().map((t) =>
    [
      t.id, `P${t.priority}`, t.status, t.source, t.locality?.en, t.locality?.ta, t.locality?.zone, t.landmark, t.lat?.toFixed(5), t.lng?.toFixed(5), t.waterLevel, t.people,
      t.vulnerable.join("; "), t.hazards.join("; "), t.needs.join("; "), t.rules.map((r) => `${r.id} ${r.label}`).join("; "), t.lang,
      new Date(t.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), t.caller,
      t.transcript.filter((x) => x.role === "caller").map((x) => x.text).join(" | "),
    ].map(esc).join(","),
  );
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="thunai-1913-tickets-SYNTHETIC.csv"` });
  res.send(`\uFEFF${cols.join(",")}\n${rows.join("\n")}\n`);
});

app.post("/api/tickets/:id/callback", limit("callback", 10, 10 * 60_000), wrap(async (req, res) => {
  const t = store.tickets.get(String(req.params.id));
  if (!t) return void res.status(404).json({ error: "not found" });
  const l = langFromCode(t.lang);
  const L = lines(l);
  const status = t.status === "dispatched" || t.status === "resolved" ? t.status : "open";
  const text = L.update(String(t.seq), L.status[status]);
  const audio = await speak(text, TTS_LANG[l]);
  t.transcript.push({ role: "thunai", text: `[call-back] ${display(text)}`, lang: TTS_LANG[l], at: Date.now(), audio: audio.url });
  store.upsert(t);
  res.json({ text: display(text), audio });
}));

app.post("/api/reset", limit("reset", 5, 10 * 60_000), (_req, res) => {
  store.reset();
  res.json({ ok: true });
});

app.get("/api/tts/:file", (req, res) => {
  const key = req.params.file.replace(/\.wav$/, "");
  if (!/^[a-f0-9]{20}$/.test(key)) return void res.status(400).end();
  const buf = readTts(key);
  if (!buf) return void res.status(404).end();
  res.set({ "Content-Type": "audio/wav", "Cache-Control": "public, max-age=86400" }).send(buf);
});

app.get("/api/recordings/:file", (req, res) => {
  const f = path.basename(req.params.file);
  const p = path.join(REC_DIR, f);
  if (!existsSync(p)) return void res.status(404).end();
  res.set("Content-Type", "audio/wav").send(readFileSync(p));
});

// ------------------------------------------------------------- call flow
app.post("/api/call/start", limit("call", 8, 10 * 60_000), wrap(async (_req, res) => {
  const { session, ticket, text } = startCall();
  const audio = await speak(text, "ta-IN");
  ticket.transcript[ticket.transcript.length - 1].audio = audio.url;
  res.json({ callId: session.id, ticketId: ticket.id, reply: { text: display(text), lang: "ta-IN", audio, step: "greeting" }, ticket });
}));

app.post("/api/call/:id/turn", limit("turn", 50, 10 * 60_000), upload.single("audio"), wrap(async (req, res) => {
  const s = getSession(String(req.params.id));
  if (!s || s.closed) return void res.status(404).json({ error: "call not active" });
  if (!req.file) return void res.status(400).json({ error: "audio missing" });
  const noise = String(req.body?.noise ?? "off");
  const t0 = performance.now();
  const stt = await transcribe(req.file.buffer, { keyterms: KEYTERMS, topic: STT_TOPIC, previousText: s.previousText, format: "codemix" });
  const n = (s.callerTurns ?? 0) + 1;
  const recName = `${s.ticketId}-${n}.wav`;
  writeFileSync(path.join(REC_DIR, recName), req.file.buffer);
  const turn = await handleCallerTurn(s, stt.transcript, stt.detectedLanguage, {
    audio: `/api/recordings/${recName}`,
    sttMs: stt.serverMs,
    roundTripMs: stt.roundTripMs,
    noise,
  });
  const ttsLang = TTS_LANG[s.lang];
  const audio = await speak(turn.replyText, ttsLang);
  const last = turn.ticket.transcript[turn.ticket.transcript.length - 1];
  last.audio = audio.url;
  store.upsert(turn.ticket);
  res.json({
    caller: { transcript: stt.transcript, lang: stt.detectedLanguage, sttMs: stt.serverMs, roundTripMs: stt.roundTripMs, requestId: stt.requestId, audio: `/api/recordings/${recName}` },
    extraction: { evidence: turn.extraction.evidence, confirm: turn.extraction.confirm },
    reply: { text: display(turn.replyText), lang: ttsLang, audio, step: turn.step },
    done: turn.done,
    ticket: turn.ticket,
    timings: { totalMs: Math.round(performance.now() - t0), llmMs: turn.llmMs },
  });
}));

app.post("/api/call/:id/end", (req, res) => {
  const s = getSession(String(req.params.id));
  if (!s) return void res.json({ ok: true });
  const t = endCall(s);
  res.json({ ok: true, ticket: t ?? null });
});

// ------------------------------------------------------------- scripted demo callers
// A Timbre v3.0 voice plays the caller when no human is available. Labelled as simulated in the UI.
const SCENARIOS = [
  {
    id: "pallikaranai",
    title: "Pallikaranai · bedridden mother",
    voice: "Devansh",
    lang: "ta-IN",
    lines: [
      "ஹலோ, நான் Pallikaranai-ல இருந்து பேசுறேன், Velachery main road பக்கத்துல. வீட்டுக்குள்ள water waist level வந்துடுச்சு, அம்மா bedridden, current இல்ல.",
      "ஆமா, சரிதான்.",
      "நாங்க மூணு பேர் இருக்கோம், boat வேணும்.",
    ],
  },
  {
    id: "kodungaiyur",
    title: "Kodungaiyur · live wire (English)",
    voice: "Riyaa",
    lang: "en-IN",
    lines: [
      "Hello, I am calling from Kodungaiyur, near the bus stand. The water is knee level and a current wire has fallen into the water on our street.",
      "Yes, that is correct.",
      "There are five of us, my grandfather is also here.",
    ],
  },
  {
    id: "perungudi",
    title: "Perungudi · migrant workers (Hindi)",
    voice: "Shubham",
    lang: "hi-IN",
    lines: [
      "हेलो, मैं Perungudi से बोल रहा हूँ, construction site के पास। हमारे कमरे में पानी कमर तक आ गया है, हम दस लोग हैं।",
      "हाँ, सही है।",
      "हमें खाना और पीने का पानी चाहिए।",
    ],
  },
  {
    id: "mudichur",
    title: "Mudichur · trapped on terrace",
    voice: "Lakshmi",
    lang: "ta-IN",
    lines: [
      "Sir please help, Mudichur-ல Varadarajapuram பக்கத்துல மொட்டை மாடி-ல மாட்டிக்கிட்டோம். தண்ணி நெஞ்சு அளவு இருக்கு, கைக்குழந்தை இருக்கு.",
      "ஆமா ஆமா, சீக்கிரம் வாங்க.",
      "நாலு பேர், boat அனுப்புங்க.",
    ],
  },
];

app.get("/api/demo/scenarios", (_req, res) => res.json(SCENARIOS.map(({ id, title, voice, lang, lines }) => ({ id, title, voice, lang, lines: lines.length }))));

app.get("/api/demo/line/:id/:n", wrap(async (req, res) => {
  const sc = SCENARIOS.find((s) => s.id === req.params.id);
  const n = Number(String(req.params.n).replace(/\.wav$/, ""));
  if (!sc || !(n >= 0 && n < sc.lines.length)) return void res.status(404).end();
  const r = await synthesize(sc.lines[n], { voice: sc.voice, language: sc.lang, sampleRate: 16000 });
  res.set({ "Content-Type": "audio/wav", "Cache-Control": "public, max-age=86400" }).send(readFileSync(r.file));
}));

// ------------------------------------------------------------- backlog + eval
app.get("/api/backlog", (_req, res) => {
  const r = results();
  res.json({ notes: manifest().length, results: r ? { jobId: r.jobId, ranAt: r.ranAt, elapsedMs: r.elapsedMs, files: r.files.length, config: r.config } : null });
});

app.get("/api/backlog/audio/:file", (req, res) => {
  const p = path.join(BACKLOG_DIR, "audio", path.basename(req.params.file));
  if (!existsSync(p)) return void res.status(404).end();
  res.set("Content-Type", "audio/wav").send(readFileSync(p));
});

app.post("/api/backlog/replay", limit("replay", 6, 10 * 60_000), wrap(async (_req, res) => {
  store.emit("backlog", { stage: "replay" });
  const n = await replay();
  store.emit("backlog", { stage: "replayed", n });
  res.json({ ok: true, n });
}));

app.post("/api/backlog/run", wrap(async (_req, res) => {
  if (PUBLIC) return void res.status(403).json({ error: "Live Batch runs are disabled on the public demo; replaying the recorded job." });
  res.json({ ok: true, started: true });
  runBatch((p) => store.emit("backlog", p))
    .then(() => replay())
    .then((n) => store.emit("backlog", { stage: "replayed", n }))
    .catch((e) => store.emit("backlog", { stage: "error", error: String(e?.message ?? e) }));
}));

app.get("/api/eval", (_req, res) => {
  const p = path.join(DATA_DIR, "eval", "results.json");
  res.json(existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
});

app.get("/api/eval/audio/:file", (req, res) => {
  const p = path.join(DATA_DIR, "eval", "audio", path.basename(req.params.file));
  if (!existsSync(p)) return void res.status(404).end();
  res.set("Content-Type", "audio/wav").send(readFileSync(p));
});

// ------------------------------------------------------------- static (production)
const dist = path.join(ROOT, "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

/** Render every fixed prompt once so live calls only wait on Timbre for the dynamic lines. */
async function prewarm() {
  const jobs: [string, string, string][] = [];
  for (const l of ["ta", "en", "hi", "te"] as const) {
    const L = lines(l);
    for (const k of ["greeting", "askLocality", "askLocalityAgain", "askWater", "askPeople", "askNeeds", "repeat"] as const) jobs.push([L[k], TTS_LANG[l], VOICE]);
  }
  for (const s of SCENARIOS) for (const line of s.lines) jobs.push([line, s.lang, s.voice]);
  let made = 0;
  for (const [text, lang, voice] of jobs) {
    try {
      const r = await synthesize(text, { voice, language: lang, sampleRate: voice === VOICE ? 24000 : 16000 });
      if (!r.cached) made++;
    } catch {
      /* the live path will retry */
    }
  }
  if (made) console.log(`[thunai] pre-rendered ${made} fixed prompts with Timbre v3.0`);
}

app.listen(env.port, () => {
  console.log(`[thunai] API on http://localhost:${env.port}  ·  Prisma v3.0 + Timbre v3.0  ·  ${KEYTERMS.length} keyterms  ·  LLM assist: ${llmEnabled() ? "on" : "off (rules only)"}`);
  setTimeout(() => void prewarm(), 1500);
});
