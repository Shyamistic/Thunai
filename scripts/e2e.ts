// Browser end-to-end check: run one full scripted call through the real UI in local Chrome,
// then screenshot the control room, the ticket drawer and the noise lab.
import { chromium } from "playwright-core";
import path from "node:path";

const URL = process.env.WEB ?? "http://localhost:5173";
const scenario = process.argv[2] ?? "pallikaranai";
const out = (n: string) => path.resolve("data/cache", n);

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const logs: string[] = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(URL);
await page.waitForTimeout(2500);
await page.selectOption("select[title='Use a Timbre voice as the caller']", scenario);
await page.getByRole("button", { name: /Answer overflow call|Take next call/ }).click();

const t0 = Date.now();
let shot = 0;
while (Date.now() - t0 < 120_000) {
  await page.waitForTimeout(4000);
  const status = await page.locator("text=Call ended · ticket filed").count();
  if (shot < 2 && Date.now() - t0 > 14_000 * (shot + 1)) await page.screenshot({ path: out(`e2e-call-${++shot}.png`) });
  if (status) break;
}
console.log(`call finished in ${Math.round((Date.now() - t0) / 1000)} s`);
await page.waitForTimeout(2500);
await page.screenshot({ path: out("e2e-ended.png") });

// open the top ticket in the drawer
await page.locator("main button.group").first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: out("e2e-drawer.png") });
await page.keyboard.press("Escape");

await page.goto(`${URL}/lab`);
await page.waitForTimeout(2500);
await page.screenshot({ path: out("e2e-lab.png"), fullPage: false });

console.log(logs.filter((l) => !l.includes("[vite]") && !l.includes("React DevTools")).join("\n") || "no console errors");
await browser.close();
