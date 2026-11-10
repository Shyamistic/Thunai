// Renders public/og.jpg (1200×630), the link-preview card for LinkedIn, X and GitHub:
// the real board with the backlog loaded, under a title overlay.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const WEB = process.env.WEB ?? "http://localhost:5173";
const API = process.env.API ?? "http://localhost:8787";
const ffmpeg: string = createRequire(import.meta.url)("ffmpeg-static");

await fetch(`${API}/api/reset`, { method: "POST" });
await fetch(`${API}/api/backlog/replay`, { method: "POST" });

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 840 } });
await page.goto(WEB);
await page.waitForTimeout(4000);
await page.addStyleTag({
  content: `#og{position:fixed;inset:0;z-index:5000;display:flex;flex-direction:column;justify-content:center;padding-left:120px;gap:18px;
    background:linear-gradient(90deg,rgba(4,8,11,.97) 0%,rgba(4,8,11,.9) 46%,rgba(4,8,11,.25) 80%,rgba(4,8,11,.1) 100%)}
  #og .k{font:500 18px/1 "IBM Plex Mono";letter-spacing:.28em;color:#ff4b2b}
  #og .t{font:600 64px/1 "Noto Sans Tamil";color:#fff4dc}
  #og .h{font:800 120px/0.9 "Big Shoulders Display";color:#ede6d6;letter-spacing:.02em}
  #og .h b{color:#f4b23f}
  #og .s{font:500 26px/1.4 "IBM Plex Sans";color:#9fb3bb;max-width:760px}
  #og .s em{font-style:normal;color:#ede6d6}`,
});
await page.evaluate(() => {
  const el = document.createElement("div");
  el.id = "og";
  el.innerHTML = `<div class="k">● CHENNAI · 1913 FLOOD LINE</div>
    <div class="t">துணை</div>
    <div class="h">THUNAI <b>1913</b></div>
    <div class="s">Tanglish distress calls on a noisy phone line → <em>ranked tickets on a live map</em>.<br/>Gnani Prisma v3.0 + Timbre v3.0</div>`;
  document.body.appendChild(el);
});
await page.waitForTimeout(600);
const png = path.resolve("data/cache/og.png");
await page.screenshot({ path: png });
await browser.close();
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", png, "-vf", "scale=1200:630:flags=lanczos", "-q:v", "3", path.resolve("public/og.jpg")]);
console.log("public/og.jpg");
