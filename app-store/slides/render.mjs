// Rend chaque planche en PNG 1600×900, puis en JPG pour l'App Store.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const ici = path.dirname(fileURLToPath(import.meta.url));
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.goto("file://" + path.join(ici, "slides.html"));
// Les polices Google doivent être arrivées : sans cette attente la première
// planche part en police de repli et détonne face aux cinq autres.
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);

for (let i = 1; i <= 6; i++) {
  const num = String(i).padStart(2, "0");
  await page.locator(`#s${i}`).screenshot({
    path: path.join(ici, "..", "planches-png", `variantsy-${num}.png`),
  });
  console.log(`variantsy-${num}.png`);
}
await navigateur.close();
