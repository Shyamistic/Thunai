// One distress call = one session. Each caller turn: Prisma v3.0 → rules → (optional model) →
// merge into the ticket → pick the next scripted line → Timbre v3.0.
import { randomUUID } from "node:crypto";
import { extract, type Extraction, type Hazard, type Need, type Vulnerable, type WaterLevel } from "./extract.ts";
import { getLocality, type Locality } from "./gazetteer.ts";
import { llmAssist } from "./llm.ts";
import { display, langFromCode, lines, placeName, safetyScript, TTS_LANG, type L } from "./script.ts";
import { jitter, store, syntheticCaller, type Ticket } from "./store.ts";
import { triage } from "./triage.ts";

export type Step = "greeting" | "askLocality" | "askLocalityAgain" | "readBack" | "askWater" | "askPeople" | "askNeeds" | "repeat" | "close";

export interface CallSession {
  id: string;
  ticketId: string;
  lang: L;
  startedAt: number;
  asked: Partial<Record<Step, number>>;
  awaitingConfirm: boolean;
  closed: boolean;
  callerTurns: number;
  previousText: string;
  vulnerableAnswered: boolean;
}

const sessions = new Map<string, CallSession>();
const lastSeen = new Map<string, number>();

// A caller who hangs up without "End call" (closed tab, dropped line) must not stay "ON CALL".
setInterval(() => {
  const cutoff = Date.now() - 3 * 60_000;
  for (const [id, s] of sessions) if ((lastSeen.get(id) ?? s.startedAt) < cutoff) endCall(s);
}, 30_000).unref();
// Tickets left "live" by a previous server run are closed (or dropped if empty) at startup.
setTimeout(() => {
  for (const t of [...store.tickets.values()]) {
    if (t.status !== "live") continue;
    if (!t.transcript.some((x) => x.role === "caller")) {
      store.tickets.delete(t.id);
      store.emit("remove", { id: t.id });
    } else {
      t.status = "open";
      store.upsert(t);
    }
  }
}, 0);

export function getSession(id: string): CallSession | undefined {
  return sessions.get(id);
}

export function newTicket(source: Ticket["source"], lang: string): Ticket {
  const { id, seq } = store.nextId();
  const now = Date.now();
  return {
    id,
    seq,
    source,
    status: source === "call" ? "live" : "open",
    createdAt: now,
    updatedAt: now,
    caller: syntheticCaller(seq),
    lang,
    locality: null,
    localityConfirmed: false,
    lat: null,
    lng: null,
    vulnerable: [],
    hazards: [],
    needs: [],
    priority: 3,
    score: 0,
    rules: [],
    transcript: [],
    evidence: [],
    synthetic: true,
  };
}

export function startCall(): { session: CallSession; ticket: Ticket; text: string } {
  const ticket = newTicket("call", "ta-IN");
  const session: CallSession = {
    id: randomUUID(),
    ticketId: ticket.id,
    lang: "ta",
    startedAt: Date.now(),
    asked: { greeting: 1 },
    awaitingConfirm: false,
    closed: false,
    callerTurns: 0,
    previousText: "",
    vulnerableAnswered: false,
  };
  sessions.set(session.id, session);
  const text = lines("ta").greeting;
  ticket.transcript.push({ role: "thunai", text: display(text), lang: "ta-IN", at: Date.now() });
  store.upsert(ticket);
  return { session, ticket, text };
}

function setLocality(t: Ticket, loc: Locality): void {
  const [lat, lng] = jitter(loc.lat, loc.lng, t.seq);
  t.locality = { id: loc.id, en: loc.en, ta: loc.ta, zone: loc.zone, lat: loc.lat, lng: loc.lng };
  t.lat = lat;
  t.lng = lng;
}

const union = <T>(a: T[], b: T[]) => [...new Set([...a, ...b])];

/** Merge one turn's extraction into the ticket. Later statements win for single values. */
export function mergeInto(t: Ticket, ex: Extraction, opts: { replaceLocality?: boolean } = {}): void {
  if (ex.locality && (!t.locality || opts.replaceLocality || t.locality.id !== ex.locality.id)) {
    if (!t.locality || opts.replaceLocality || !t.localityConfirmed) {
      if (t.locality?.id !== ex.locality.id) t.localityConfirmed = false;
      setLocality(t, ex.locality);
    }
  }
  if (ex.landmark) t.landmark = ex.landmark;
  if (ex.waterLevel) t.waterLevel = ex.waterLevel as WaterLevel;
  if (ex.people !== undefined) t.people = ex.people;
  t.vulnerable = union<Vulnerable>(t.vulnerable, ex.vulnerable);
  if (t.vulnerable.includes("infant")) t.vulnerable = t.vulnerable.filter((v) => v !== "child");
  t.hazards = union<Hazard>(t.hazards, ex.hazards);
  t.needs = union<Need>(t.needs, ex.needs);
  if ((t.hazards.includes("trapped") || t.hazards.includes("stranded")) && !t.needs.includes("rescue")) t.needs.push("rescue");
  for (const e of ex.evidence) if (!t.evidence.some((x) => x.field === e.field && x.value === e.value)) t.evidence.push(e);
  applyTriage(t);
}

export function applyTriage(t: Ticket): void {
  const r = triage({ waterLevel: t.waterLevel, people: t.people, vulnerable: t.vulnerable, hazards: t.hazards, needs: t.needs, localityKnown: Boolean(t.locality) });
  t.priority = r.priority;
  t.score = r.score;
  t.rules = r.rules;
}

function nextStep(s: CallSession, t: Ticket): Step {
  const asked = (k: Step) => s.asked[k] ?? 0;
  if (s.callerTurns >= 7) return "close";
  if (!t.locality) {
    if (asked("askLocality") + asked("askLocalityAgain") >= 2) return t.waterLevel ? "close" : asked("askWater") ? "close" : "askWater";
    return asked("askLocality") ? "askLocalityAgain" : "askLocality";
  }
  if (!t.localityConfirmed && asked("readBack") < 2) return "readBack";
  if (!t.waterLevel && asked("askWater") < 1) return "askWater";
  if (t.people === undefined && !t.vulnerable.length && !s.vulnerableAnswered && asked("askPeople") < 1) return "askPeople";
  if (!t.needs.length && !t.hazards.some((h) => h === "trapped" || h === "medical" || h === "liveWire") && asked("askNeeds") < 1) return "askNeeds";
  return "close";
}

function spokenTicket(t: Ticket): string {
  return String(t.seq);
}

function lineFor(step: Step, s: CallSession, t: Ticket): string {
  const L = lines(s.lang);
  switch (step) {
    case "readBack": {
      const loc = getLocality(t.locality?.id)!;
      return L.readBack(placeName(loc, s.lang), t.landmark);
    }
    case "close":
      return L.close(spokenTicket(t), t.priority, L.dispatch[t.priority], safetyScript(s.lang, t.waterLevel, t.hazards));
    case "greeting":
      return L.greeting;
    default:
      return L[step];
  }
}

export interface TurnResult {
  transcript: string;
  lang: string;
  step: Step;
  replyText: string;
  done: boolean;
  ticket: Ticket;
  extraction: Extraction;
  llmMs: number;
}

export async function handleCallerTurn(s: CallSession, transcript: string, detected: string | null, meta: { audio?: string; sttMs?: number | null; roundTripMs?: number; noise?: string }): Promise<TurnResult> {
  const t = store.tickets.get(s.ticketId)!;
  lastSeen.set(s.id, Date.now());
  s.callerTurns += 1;
  const lang = detected ?? TTS_LANG[s.lang];
  // Language ID on a two-word "yes" is unreliable; only a real sentence may switch the call's language.
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  if (transcript.trim() && (s.callerTurns === 1 || words >= 4)) s.lang = langFromCode(lang);
  t.lang = TTS_LANG[s.lang];
  t.transcript.push({ role: "caller", text: transcript, lang, at: Date.now(), ...meta });

  const ex = extract(transcript);
  const { ms: llmMs } = await llmAssist(transcript, ex);

  let replaceLocality = false;
  if (s.awaitingConfirm) {
    s.awaitingConfirm = false;
    if (ex.locality && ex.locality.id !== t.locality?.id) {
      replaceLocality = true; // caller corrected the place
    } else if (ex.confirm === "yes") {
      t.localityConfirmed = true;
    } else if (ex.confirm === "no") {
      t.locality = null;
      t.lat = null;
      t.lng = null;
      t.localityConfirmed = false;
      s.asked.askLocality = Math.max(1, s.asked.askLocality ?? 0);
    }
  }
  if ((s.asked.askPeople ?? 0) > 0 && (ex.vulnerableNone || ex.confirm === "no")) s.vulnerableAnswered = true;
  mergeInto(t, ex, { replaceLocality });

  let step: Step;
  if (!transcript.trim()) step = (s.asked.repeat ?? 0) < 2 ? "repeat" : nextStep(s, t);
  else step = nextStep(s, t);
  if (step === "readBack") s.awaitingConfirm = true;
  s.asked[step] = (s.asked[step] ?? 0) + 1;
  s.previousText = `${s.previousText} ${transcript}`.slice(-600);

  const replyText = lineFor(step, s, t);
  const done = step === "close";
  if (done) {
    s.closed = true;
    t.status = "open";
    t.closedAt = Date.now();
  }
  t.transcript.push({ role: "thunai", text: display(replyText), lang: TTS_LANG[s.lang], at: Date.now() });
  store.upsert(t);
  return { transcript, lang, step, replyText, done, ticket: t, extraction: ex, llmMs };
}

export function endCall(s: CallSession): Ticket | undefined {
  const t = store.tickets.get(s.ticketId);
  s.closed = true;
  sessions.delete(s.id);
  lastSeen.delete(s.id);
  if (!t) return undefined;
  if (t.status === "live") {
    if (!t.locality && t.transcript.filter((x) => x.role === "caller").length === 0) {
      store.tickets.delete(t.id);
      store.emit("remove", { id: t.id });
      return undefined;
    }
    t.status = "open";
    t.closedAt = Date.now();
    store.upsert(t);
  }
  return t;
}

/** Voice notes have no conversation: one transcript becomes one ticket. */
export async function ticketFromVoiceNote(transcript: string, lang: string, meta: { file: string; audio?: string; createdAt?: number }): Promise<Ticket> {
  const t = newTicket("voicenote", lang);
  if (meta.createdAt) t.createdAt = meta.createdAt;
  t.transcript.push({ role: "caller", text: transcript, lang, at: t.createdAt, audio: meta.audio });
  const ex = extract(transcript);
  await llmAssist(transcript, ex);
  mergeInto(t, ex);
  t.localityConfirmed = false;
  return t;
}
