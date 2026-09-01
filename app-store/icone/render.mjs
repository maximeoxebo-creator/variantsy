// Rend l'icône en 1200 × 1200, une image par variante de luminosité.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const ici = path.dirname(fileURLToPath(import.meta.url));
const nav = await chromium.launch();
const page = await nav.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
for (const v of ["A", "B", "C"]) {
  await page.goto(`file://${path.join(ici, "icone.html")}?v=${v}`);
  await page.locator(".icone").screenshot({ path: path.join(ici, `variantsy-icon-${v}.png`) });
  console.log(`variantsy-icon-${v}.png`);
}
await nav.close();
