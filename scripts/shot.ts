// Screenshot any page of the running app: npx tsx scripts/shot.ts /how how.png
import { chromium } from "playwright-core";
import path from "node:path";

const [route = "/", file = "shot.png"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`${process.env.WEB ?? "http://localhost:5173"}${route}`);
await page.waitForTimeout(3500);
await page.screenshot({ path: path.resolve("data/cache", file) });
await browser.close();
console.log(`saved data/cache/${file}`);
