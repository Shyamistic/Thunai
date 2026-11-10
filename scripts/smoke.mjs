// Smoke test: Timbre v3.0 renders a Tamil/Tanglish line, Prisma v3.0 transcribes it back.
// Prints response shapes only, never the key.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const KEY = env.GNANI_API_KEY;
mkdirSync(new URL("../data/cache/", import.meta.url), { recursive: true });

const text = "வணக்கம், நான் பள்ளிக்கரணை-ல இருக்கேன். water waist level வந்துடுச்சு, அம்மா bedridden.";
let t0 = Date.now();
const tts = await fetch("https://api.vachana.ai/api/v1/tts/inference", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-API-Key-ID": KEY },
  body: JSON.stringify({
    text,
    voice: "Kalpana",
    model: "timbre-v3.0",
    language: "ta-IN",
    audio_config: { sample_rate: 16000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "wav" },
  }),
});
console.log("TTS status", tts.status, tts.headers.get("content-type"), `${Date.now() - t0}ms`);
if (!tts.ok) { console.log(await tts.text()); process.exit(1); }
const wav = Buffer.from(await tts.arrayBuffer());
writeFileSync(new URL("../data/cache/smoke.wav", import.meta.url), wav);
console.log("WAV bytes", wav.length);

for (const format of ["codemix", "transcribe"]) {
  const fd = new FormData();
  fd.append("audio_file", new Blob([wav], { type: "audio/wav" }), "smoke.wav");
  fd.append("model", "prisma-v3.0");
  fd.append("language_code", "ta-IN,en-IN,hi-IN,te-IN");
  fd.append("format", format);
  fd.append("keyterms", JSON.stringify(["பள்ளிக்கரணை", "Pallikaranai", "bedridden", "waist level"]));
  fd.append("topic", "Flood distress call to Chennai Corporation helpline during a cyclone");
  t0 = Date.now();
  const stt = await fetch("https://api.vachana.ai/stt/v3", { method: "POST", headers: { "X-API-Key-ID": KEY }, body: fd });
  console.log(`STT[${format}] status`, stt.status, `${Date.now() - t0}ms`);
  console.log(await stt.text());
}
