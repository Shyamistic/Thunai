// Noise lab: does Prisma v3.0 still get Chennai place names right on a bad phone line in a storm?
// Timbre v3.0 renders each line straight to G.711 µ-law 8 kHz, we band-limit and add storm noise
// at 10 dB and 5 dB SNR, then transcribe with and without Thunai's keyterms.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decodeMulaw, encodeWav, mixAtSnr, padSilence, telephoneBand, type Pcm } from "../server/audio.ts";
import { DATA_DIR } from "../server/env.ts";
import { extract } from "../server/extract.ts";
import { buildKeyterms, STT_TOPIC } from "../server/gazetteer.ts";
import { synthesize, transcribe } from "../server/gnani.ts";

interface Line {
  id: string;
  lang: string;
  text: string;
  truth: { locality: string; water?: string; people?: number; vulnerable?: string[] };
}

const LINES: Line[] = [
  { id: "L01", lang: "ta-IN", text: "ஹலோ, நான் பள்ளிக்கரணை-ல இருந்து பேசுறேன். வீட்டுக்குள்ள தண்ணி இடுப்பு அளவு வந்துடுச்சு, அம்மா bedridden.", truth: { locality: "pallikaranai", water: "waist", vulnerable: ["bedridden"] } },
  { id: "L02", lang: "ta-IN", text: "சார், முடிச்சூர்-ல மொட்டை மாடி-ல மாட்டிக்கிட்டோம். தண்ணி நெஞ்சு அளவு, கைக்குழந்தை இருக்கு.", truth: { locality: "mudichur", water: "chest", vulnerable: ["infant"] } },
  { id: "L03", lang: "ta-IN", text: "வேளச்சேரி Vijaya Nagar பக்கத்துல தண்ணி முட்டி அளவு இருக்கு, நாங்க நாலு பேர் இருக்கோம்.", truth: { locality: "velachery", water: "knee", people: 4 } },
  { id: "L04", lang: "ta-IN", text: "கொடுங்கையூர்-ல current wire தண்ணியில விழுந்துடுச்சு, தண்ணி கணுக்கால் அளவு.", truth: { locality: "kodungaiyur", water: "ankle" } },
  { id: "L05", lang: "ta-IN", text: "வரதராஜபுரம்-ல எங்க தெரு முழுக்க தண்ணி, இடுப்பு அளவு. தாத்தா வயசானவர், நடக்க முடியாது.", truth: { locality: "varadarajapuram", water: "waist", vulnerable: ["elderly"] } },
  { id: "L06", lang: "ta-IN", text: "செம்மஞ்சேரி-ல இருக்கோம், வீட்டுக்குள்ள தண்ணி முட்டி அளவு. dialysis patient இருக்காங்க, மருந்து வேணும்.", truth: { locality: "semmencherry", water: "knee", vulnerable: ["dialysis"] } },
  { id: "L07", lang: "en-IN", text: "Hello, I am in Madipakkam near Ram Nagar. The water is waist level and we are five people.", truth: { locality: "madipakkam", water: "waist", people: 5 } },
  { id: "L08", lang: "en-IN", text: "Please help, we are in Thoraipakkam. The water is chest deep and my grandmother is with us.", truth: { locality: "thoraipakkam", water: "chest", vulnerable: ["elderly"] } },
  { id: "L09", lang: "hi-IN", text: "मैं Perungudi में हूँ, पानी कमर तक है, हम दस लोग हैं।", truth: { locality: "perungudi", water: "waist", people: 10 } },
  { id: "L10", lang: "ta-IN", text: "வியாசர்பாடி subway பக்கத்துல தண்ணி நெஞ்சு அளவு, ரெண்டு பேர் மாட்டிக்கிட்டோம்.", truth: { locality: "vyasarpadi", water: "chest", people: 2 } },
  { id: "L11", lang: "ta-IN", text: "கே.கே. நகர்-ல மரம் விழுந்துடுச்சு, current இல்ல, தண்ணி முட்டி அளவு.", truth: { locality: "kknagar", water: "knee" } },
  { id: "L12", lang: "ta-IN", text: "ஒக்கியம் துரைப்பாக்கம்-ல நெஞ்சு அளவு தண்ணி, மூணு பேர் மாட்டிக்கிட்டோம், boat அனுப்புங்க.", truth: { locality: "okkiyam", water: "chest", people: 3 } },
];
const VOICES = ["Devansh", "Lakshmi"];
const CONDITIONS = [
  { id: "clean", snr: null as number | null },
  { id: "10dB", snr: 10 },
  { id: "5dB", snr: 5 },
];

const OUT = path.join(DATA_DIR, "eval");
const AUDIO = path.join(OUT, "audio");
mkdirSync(AUDIO, { recursive: true });
const keyterms = buildKeyterms();

function score(transcript: string, t: Line["truth"]) {
  const ex = extract(transcript);
  let ok = 0;
  let total = 1;
  const localityOk = ex.locality?.id === t.locality;
  if (localityOk) ok++;
  if (t.water) {
    total++;
    if (ex.waterLevel === t.water) ok++;
  }
  if (t.people !== undefined) {
    total++;
    if (ex.people === t.people) ok++;
  }
  if (t.vulnerable) {
    total++;
    if (t.vulnerable.every((v) => ex.vulnerable.includes(v as never))) ok++;
  }
  return { ex, ok, total, localityOk };
}

function summarise(rows: Record<string, unknown>[]) {
  const summary = [];
  for (const cond of CONDITIONS) {
    for (const kt of [true, false]) {
      const rs = rows.filter((r) => r.condition === cond.id && r.keyterms === kt) as { localityOk: boolean; fieldsOk: number; fieldsTotal: number; sttMs: number | null }[];
      const ms = rs.map((r) => r.sttMs ?? 0).sort((a, b) => a - b);
      summary.push({
        condition: cond.id,
        keyterms: kt,
        n: rs.length,
        localityAcc: rs.filter((r) => r.localityOk).length / rs.length,
        fieldAcc: rs.reduce((a, r) => a + r.fieldsOk, 0) / rs.reduce((a, r) => a + r.fieldsTotal, 0),
        medianSttMs: ms[Math.floor(ms.length / 2)],
      });
    }
  }
  return summary;
}

// --rescore: re-run the extractor over saved transcripts without calling Prisma again
if (process.argv.includes("--rescore")) {
  const saved = JSON.parse(readFileSync(path.join(OUT, "results.json"), "utf8"));
  for (const r of saved.rows) {
    if (String(r.transcript).startsWith("ERROR")) {
      // a rate-limited request is an infrastructure failure, not a recognition result: try again
      await new Promise((res) => setTimeout(res, 1500));
      const wav = readFileSync(path.join(AUDIO, path.basename(r.audio)));
      const stt = await transcribe(wav, { keyterms: r.keyterms ? keyterms : undefined, topic: r.keyterms ? STT_TOPIC : undefined, format: "codemix" });
      r.transcript = stt.transcript;
      r.sttMs = stt.serverMs;
      r.lang = stt.detectedLanguage;
      console.log(`re-transcribed ${r.id} ${r.voice} ${r.condition} kt=${r.keyterms}`);
    }
    const s = score(r.transcript, r.truth);
    r.got = { locality: s.ex.locality?.id, water: s.ex.waterLevel, people: s.ex.people, vulnerable: s.ex.vulnerable };
    r.localityOk = s.localityOk;
    r.fieldsOk = s.ok;
    r.fieldsTotal = s.total;
  }
  saved.summary = summarise(saved.rows);
  writeFileSync(path.join(OUT, "results.json"), JSON.stringify(saved, null, 2));
  console.table(saved.summary.map((s: { localityAcc: number; fieldAcc: number }) => ({ ...s, localityAcc: `${Math.round(s.localityAcc * 100)}%`, fieldAcc: `${Math.round(s.fieldAcc * 100)}%` })));
  process.exit(0);
}

type Job = { line: Line; voice: string; cond: (typeof CONDITIONS)[number]; kt: boolean; wav: Buffer; file: string };
const jobs: Job[] = [];

for (const line of LINES) {
  for (const voice of VOICES) {
    const r = await synthesize(line.text, { voice, language: line.lang, container: "mulaw" });
    const base: Pcm = padSilence(telephoneBand({ rate: 8000, samples: decodeMulaw(readFileSync(r.file)) }), 0.3, 0.5);
    for (const cond of CONDITIONS) {
      const pcm = cond.snr === null ? base : mixAtSnr(base, cond.snr, line.id.charCodeAt(2) * 31 + voice.length);
      const file = `${line.id}-${voice}-${cond.id}.wav`;
      const wav = encodeWav(pcm);
      if (!existsSync(path.join(AUDIO, file))) writeFileSync(path.join(AUDIO, file), wav);
      for (const kt of [true, false]) jobs.push({ line, voice, cond, kt, wav, file });
    }
    process.stdout.write(`rendered ${line.id} ${voice} ${r.cached ? "(cached)" : `${r.ms} ms`}\n`);
  }
}

const rows: Record<string, unknown>[] = [];
let done = 0;
async function worker() {
  while (jobs.length) {
    const j = jobs.shift()!;
    const stt = await transcribe(j.wav, { keyterms: j.kt ? keyterms : undefined, topic: j.kt ? STT_TOPIC : undefined, format: "codemix" }).catch((e) => ({ transcript: `ERROR ${e.status ?? ""}`, serverMs: null, detectedLanguage: null }));
    const ex = extract(stt.transcript);
    const t = j.line.truth;
    let ok = 0;
    let total = 1;
    const localityOk = ex.locality?.id === t.locality;
    if (localityOk) ok++;
    if (t.water) {
      total++;
      if (ex.waterLevel === t.water) ok++;
    }
    if (t.people !== undefined) {
      total++;
      if (ex.people === t.people) ok++;
    }
    if (t.vulnerable) {
      total++;
      if (t.vulnerable.every((v) => ex.vulnerable.includes(v as never))) ok++;
    }
    rows.push({
      id: j.line.id,
      voice: j.voice,
      condition: j.cond.id,
      keyterms: j.kt,
      truth: t,
      transcript: stt.transcript,
      got: { locality: ex.locality?.id, water: ex.waterLevel, people: ex.people, vulnerable: ex.vulnerable },
      localityOk,
      fieldsOk: ok,
      fieldsTotal: total,
      sttMs: stt.serverMs,
      lang: stt.detectedLanguage,
      audio: `/api/eval/audio/${j.file}`,
    });
    done++;
    if (done % 12 === 0) console.log(`transcribed ${done}`);
  }
}
await Promise.all([worker(), worker()]);

const summary = [];
for (const cond of CONDITIONS) {
  for (const kt of [true, false]) {
    const rs = rows.filter((r) => r.condition === cond.id && r.keyterms === kt) as { localityOk: boolean; fieldsOk: number; fieldsTotal: number; sttMs: number | null }[];
    const ms = rs.map((r) => r.sttMs ?? 0).sort((a, b) => a - b);
    summary.push({
      condition: cond.id,
      keyterms: kt,
      n: rs.length,
      localityAcc: rs.filter((r) => r.localityOk).length / rs.length,
      fieldAcc: rs.reduce((a, r) => a + r.fieldsOk, 0) / rs.reduce((a, r) => a + r.fieldsTotal, 0),
      medianSttMs: ms[Math.floor(ms.length / 2)],
    });
  }
}
rows.sort((a, b) => String(a.id).localeCompare(String(b.id)) || String(a.voice).localeCompare(String(b.voice)));
const result = { ranAt: Date.now(), model: "prisma-v3.0", conditions: CONDITIONS.map((c) => c.id), lines: LINES.length, voices: VOICES, summary, rows };
writeFileSync(path.join(OUT, "results.json"), JSON.stringify(result, null, 2));
console.table(summary.map((s) => ({ ...s, localityAcc: `${Math.round(s.localityAcc * 100)}%`, fieldAcc: `${Math.round(s.fieldAcc * 100)}%` })));
