// End-to-end check of the call API without a browser: a Timbre voice plays the caller,
// optionally mixed with storm noise on an 8 kHz phone line.
import { readFileSync } from "node:fs";
import { decodeWav, encodeWav, mixAtSnr, padSilence, resample, telephoneBand } from "../server/audio.ts";
import { synthesize } from "../server/gnani.ts";

const API = process.env.API ?? "http://localhost:8787";
const snr = process.argv.includes("--clean") ? null : 8;

const callerLines = [
  "ஹலோ, நான் Pallikaranai-ல இருந்து பேசுறேன், Velachery main road பக்கத்துல. வீட்டுக்குள்ள water waist level வந்துடுச்சு, அம்மா bedridden, current இல்ல.",
  "ஆமா, சரிதான்.",
  "நாங்க மூணு பேர் இருக்கோம்.",
];

async function callerAudio(text: string): Promise<Buffer> {
  const r = await synthesize(text, { voice: "Devansh", language: "ta-IN", sampleRate: 16000 });
  let pcm = padSilence(decodeWav(readFileSync(r.file)));
  pcm = resample(pcm, 8000);
  pcm = telephoneBand(pcm);
  if (snr !== null) pcm = mixAtSnr(pcm, snr, 11);
  return encodeWav(pcm);
}

const start = await (await fetch(`${API}/api/call/start`, { method: "POST" })).json();
console.log("THUNAI:", start.reply.text);
for (const line of callerLines) {
  const wav = await callerAudio(line);
  const fd = new FormData();
  fd.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "turn.wav");
  fd.append("noise", snr === null ? "off" : `${snr} dB`);
  const res = await fetch(`${API}/api/call/${start.callId}/turn`, { method: "POST", body: fd });
  const j = await res.json();
  if (!res.ok) {
    console.log("ERROR", j);
    break;
  }
  console.log(`\nCALLER  [${j.caller.lang} · prisma ${j.caller.sttMs}ms · rt ${j.caller.roundTripMs}ms]:`, j.caller.transcript);
  console.log(`THUNAI  [${j.reply.step} · total ${j.timings.totalMs}ms]:`, j.reply.text);
  const t = j.ticket;
  console.log(`TICKET  ${t.id} P${t.priority} ${t.locality?.en ?? "?"} lm=${t.landmark ?? "-"} water=${t.waterLevel ?? "-"} people=${t.people ?? "-"} vuln=${t.vulnerable} haz=${t.hazards} needs=${t.needs} rules=${t.rules.map((r: { id: string }) => r.id)}`);
  if (j.done) break;
}
