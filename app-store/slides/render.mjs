// Rend chaque planche en PNG (2×, pour la netteté) dans app-store/planches-png,
// comme les slides de LinguaBar. Les JPG 1600 × 900 attendus par la fiche en
// sont tirés ensuite (sips, voir le message de fin).
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const ici = path.dirname(fileURLToPath(import.meta.url));
const nav = await chromium.launch();
const page = await nav.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`file://${path.join(ici, "slides.html")}`);
// Poppins doit être arrivée : sans cette attente la première planche partait
// en police de repli.
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);

for (const section of await page.locator("section.slide").all()) {
  const id = await section.getAttribute("id");
  const nom = `variantsy-${id.slice(1)}.png`;
  await section.screenshot({ path: path.join(ici, "..", "planches-png", nom) });
  const b = await section.boundingBox();
  console.log(`${nom} — ${Math.round(b.width)}×${Math.round(b.height)}`);
}
await nav.close();
