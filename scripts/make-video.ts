// Records the ~60 s demo video end to end, with sound.
// Chrome (headless, Playwright) runs the real app with a scripted caller and on-screen captions.
// The page logs when each clip starts; afterwards we rebuild the soundtrack from those exact clips
// (caller on a phone-band line under storm noise, Thunai clean, a rain bed throughout) and mux it with ffmpeg.
//   npm run dev   (in another terminal)
//   npx tsx scripts/make-video.ts
import { chromium, type Page } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { decodeWav, encodeWav, resample, stormNoise, telephoneBand } from "../server/audio.ts";

const WEB = process.env.WEB ?? "http://localhost:5173";
const API = process.env.API ?? "http://localhost:8787";
const OUT = path.resolve("video");
const RAW = path.join(OUT, "raw");
const ffmpeg: string = createRequire(import.meta.url)("ffmpeg-static");
rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

await fetch(`${API}/api/reset`, { method: "POST" });

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream"],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: RAW, size: { width: 1600, height: 900 } } });
await context.addInitScript(() => {
  (window as unknown as { __thunaiAudio: unknown[] }).__thunaiAudio = [];
});
const page = await context.newPage();
const t0 = Date.now(); // video frame 0 is (very close to) page creation
await page.goto(WEB);
await page.waitForTimeout(3500);

// ---------------------------------------------------------------- overlay helpers
await page.addStyleTag({
  content: `
  #vo-card{position:fixed;inset:0;z-index:5000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
    background:radial-gradient(ellipse at center,rgba(4,8,11,.82),rgba(4,8,11,.97));transition:opacity .7s ease;text-align:center}
  #vo-card .k{font:500 13px/1 "IBM Plex Mono";letter-spacing:.3em;color:#ff4b2b}
  #vo-card .h{font:800 74px/0.95 "Big Shoulders Display";letter-spacing:.02em;color:#ede6d6}
  #vo-card .h b{color:#f4b23f;font-weight:800}
  #vo-card .t{font:600 30px/1.2 "Noto Sans Tamil";color:#fff4dc}
  #vo-card .s{font:400 15px/1.5 "IBM Plex Mono";color:#9fb3bb}
  #vo-cap{position:fixed;left:50%;bottom:34px;transform:translate(-50%,20px);z-index:4900;opacity:0;transition:all .45s ease;
    background:rgba(4,8,11,.92);border:1px solid #f4b23f;border-radius:14px;padding:12px 20px;max-width:1040px;
    font:500 19px/1.35 "IBM Plex Sans";color:#ede6d6;box-shadow:0 20px 50px rgba(0,0,0,.6);text-align:center}
  #vo-cap.on{opacity:1;transform:translate(-50%,0)}
  #vo-cap em{font-style:normal;color:#f4b23f}`,
});
const card = (html: string) =>
  page.evaluate((h) => {
    let el = document.getElementById("vo-card");
    if (!el) {
      el = document.createElement("div");
      el.id = "vo-card";
      document.body.appendChild(el);
    }
    el.innerHTML = h;
    el.style.opacity = "1";
  }, html);
const hideCard = () => page.evaluate(() => { const el = document.getElementById("vo-card"); if (el) el.style.opacity = "0"; setTimeout(() => el?.remove(), 800); });
const cap = (html: string) =>
  page.evaluate((h) => {
    let el = document.getElementById("vo-cap");
    if (!el) {
      el = document.createElement("div");
      el.id = "vo-cap";
      document.body.appendChild(el);
    }
    el.classList.remove("on");
    setTimeout(() => {
      el!.innerHTML = h;
      el!.classList.add("on");
    }, 250);
  }, html);
const capOff = () => page.evaluate(() => document.getElementById("vo-cap")?.classList.remove("on"));
const waitText = (p: Page, text: string, timeout = 60000) => p.locator(`text=${text}`).first().waitFor({ timeout });

// ---------------------------------------------------------------- choreography
const tStart = Date.now();
await card(`<div class="k">● CYCLONE MURASU · CHENNAI · 1 NOV 2026</div>
  <div class="h">THE 1913 FLOOD LINE<br/>IS <b>JAMMED.</b></div>
  <div class="t">துணை answers the overflow.</div>
  <div class="s">Synthetic demo · Gnani Prisma v3.0 + Timbre v3.0</div>`);
await page.waitForTimeout(3000);
await hideCard();

await cap(`20 overnight WhatsApp voice notes → <em>one Prisma v3.0 Batch job</em> · with_denoise · ranked by rules`);
await page.getByRole("button", { name: /Triage the backlog/ }).click();
await page.waitForTimeout(4800);

await page.getByRole("button", { name: /Cyclone · 5 dB/ }).click();
await page.selectOption("select[title='Use a Timbre voice as the caller']", "pallikaranai");
await cap(`Overflow call · <em>8 kHz phone line + cyclone noise at 5 dB SNR</em> · simulated caller voice`);
const tAnswer = Date.now();
 await page.getByRole("button", { name: /Answer overflow call/ }).click();

await page.locator("text=/Prisma v3\\.0 · \\d+ ms/").first().waitFor({ timeout: 60000 }); // first caller transcript
await cap(`<em>Prisma v3.0 codemix</em>: Tamil in Tamil script, English in Latin · Chennai place names as keyterms`);
await waitText(page, "Awaiting read-back");
await page.waitForTimeout(1500);
await cap(`Thunai reads the area back in Tamil · <em>the caller confirms before anyone is dispatched</em>`);
await waitText(page, "Read back · caller confirmed");
await page.waitForTimeout(800);
await cap(`<em>P1 by rule R4</em>: bedridden person + waist-deep water. Rules rank, not a model.`);
await page.locator("text=சரி. உங்க ticket").first().waitFor({ timeout: 60000 }); // closing line has started
await page.waitForTimeout(500);
await capOff();
await page.locator("main button.group").first().click(); // open the live ticket
await page.waitForTimeout(800);
await cap(`Every field keeps the words it came from · scripted safety advice, spoken <em>slow</em> by Timbre v3.0`);
await page.waitForTimeout(5000);
await page.locator("aside button").first().click(); // close drawer
await page.waitForTimeout(500);
await page.getByRole("link", { name: /Noise lab/ }).click();
await cap(`Area named correctly on an 8 kHz line at 5 dB SNR: <em>71% without keyterms → 100% with them</em>`);
await page.waitForTimeout(5500);
await capOff();
await card(`<div class="t" style="font-size:44px">துணை</div>
  <div class="h">THUNAI <b>1913</b></div>
  <div class="s">Prisma v3.0 · codemix · keyterms · Batch denoise &nbsp;|&nbsp; Timbre v3.0 · audio tags<br/>Synthetic data only · not connected to emergency services<br/>github.com/Shyamistic/Thunai</div>
  <div class="k" style="color:#f4b23f">#GnaniAI &nbsp; #GreatIndianAIInternshipChallenge</div>`);
await page.waitForTimeout(3600);
const tEnd = Date.now();

const log = (await page.evaluate(() => (window as unknown as { __thunaiAudio: { url: string; t: number }[] }).__thunaiAudio)) ?? [];
await context.close();
await browser.close();

// ---------------------------------------------------------------- soundtrack
const RATE = 48000;
const startSec = (tStart - t0) / 1000;
const dur = (tEnd - tStart) / 1000;
const track = new Float32Array(Math.ceil((dur + 1) * RATE));

// rain bed throughout, quiet
const bed = stormNoise(RATE, dur + 1, 3);
for (let i = 0; i < track.length; i++) track[i] += (bed[i] ?? 0) * 0.05;

const speech: [number, number][] = []; // [start, end] of every clip, seconds from tStart
for (const ev of log) {
  const at = (ev.t - tStart) / 1000;
  if (at > dur) continue;
  const buf = Buffer.from(await (await fetch(`${WEB}${ev.url}`)).arrayBuffer());
  let pcm = decodeWav(buf);
  const caller = ev.url.includes("/api/demo/line/");
  if (caller) {
    // what the line actually sounds like: phone band, storm under it
    pcm = telephoneBand(resample(pcm, 8000));
    const noise = stormNoise(8000, pcm.samples.length / 8000 + 0.1, Math.round(ev.t) % 1000);
    const out = new Float32Array(pcm.samples.length);
    for (let i = 0; i < out.length; i++) out[i] = pcm.samples[i] * 1.6 + noise[i] * 0.09;
    pcm = { rate: 8000, samples: out };
  }
  const s = resample(pcm, RATE).samples;
  speech.push([at, at + s.length / RATE]);
  const off = Math.max(0, Math.round(at * RATE));
  const gain = caller ? 0.9 : 1.0;
  for (let i = 0; i < s.length && off + i < track.length; i++) track[off + i] += s[i] * gain;
  console.log(`${at.toFixed(2)}s ${caller ? "caller" : "thunai"} ${ev.url}`);
}
let peak = 0;
for (const v of track) peak = Math.max(peak, Math.abs(v));
if (peak > 0.95) for (let i = 0; i < track.length; i++) track[i] *= 0.95 / peak;
const wavPath = path.join(OUT, "soundtrack.wav");
writeFileSync(wavPath, encodeWav({ rate: RATE, samples: track }));

// ---------------------------------------------------------------- dead-air trim
// Waiting for the network between turns is real, but it isn't worth 3 s of a 60 s video.
// Any silent gap longer than 1.4 s during the call is cut down to about 1 s (audio and video together).
speech.sort((a, b) => a[0] - b[0]);
const marks: [number, number][] = [[(tAnswer - tStart) / 1000, (tAnswer - tStart) / 1000], ...speech];
const cuts: [number, number][] = [];
let lastEnd = marks[0][1];
for (const [s, e] of marks.slice(1)) {
  if (s - lastEnd > 1.4) cuts.push([lastEnd + 0.5, s - 0.5]);
  lastEnd = Math.max(lastEnd, e);
}
const keep: [number, number][] = [];
let cursor = 0;
for (const [a, b] of cuts) {
  keep.push([cursor, a]);
  cursor = b;
}
keep.push([cursor, dur]);
const finalDur = keep.reduce((acc, [a, b]) => acc + (b - a), 0);
console.log(`cuts: ${cuts.map(([a, b]) => `${a.toFixed(1)}–${b.toFixed(1)}`).join(", ") || "none"}`);

// ---------------------------------------------------------------- mux
const webm = readdirSync(RAW).find((f) => f.endsWith(".webm"))!;
const mp4 = path.join(OUT, "thunai-1913-demo.mp4");
const parts: string[] = [];
const labels: string[] = [];
keep.forEach(([a, b], k) => {
  const len = b - a;
  parts.push(`[0:v]trim=start=${(startSec + a).toFixed(3)}:end=${(startSec + b).toFixed(3)},setpts=PTS-STARTPTS[v${k}]`);
  parts.push(`[1:a]atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${Math.max(0, len - 0.04).toFixed(3)}:d=0.04[a${k}]`);
  labels.push(`[v${k}][a${k}]`);
});
parts.push(`${labels.join("")}concat=n=${keep.length}:v=1:a=1[vc][ac]`);
parts.push(`[vc]fps=30,scale=1920:1080:flags=lanczos[vout]`);
execFileSync(ffmpeg, [
  "-y", "-loglevel", "error",
  "-i", path.join(RAW, webm),
  "-i", wavPath,
  "-filter_complex", parts.join(";"),
  "-map", "[vout]", "-map", "[ac]",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart",
  mp4,
], { stdio: "inherit" });
console.log(`\n${mp4}  ·  ${finalDur.toFixed(1)} s (recorded ${dur.toFixed(1)} s)`);
