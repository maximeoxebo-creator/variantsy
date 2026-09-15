// Rend chaque déclinaison de couleur en 1200 × 1200, puis une planche qui les
// compare côte à côte — en grand ET à la taille où l'App Store les montre
// vraiment. Une icône se juge en vignette : c'est là qu'une teinte tient ou
// se noie.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import path from "path";

const ici = path.dirname(fileURLToPath(import.meta.url));
const PALETTES = ["violet", "emeraude", "foret", "soleil", "corail"];
const LIBELLES = {
  violet: "Violet — actuel",
  emeraude: "Émeraude",
  foret: "Forêt",
  soleil: "Soleil",
  corail: "Corail",
};

const nav = await chromium.launch();
const page = await nav.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
for (const p of PALETTES) {
  await page.goto(`file://${path.join(ici, "declinaisons.html")}?p=${p}`);
  await page.locator(".icone").screenshot({ path: path.join(ici, `variantsy-icon-${p}.png`) });
  console.log(`variantsy-icon-${p}.png`);
}

// Planche : chaque icône en 300 px, puis en 64 px et 32 px — la taille d'une
// ligne de résultat de recherche et celle d'un onglet d'admin.
const img = (p) =>
  `data:image/png;base64,${readFileSync(path.join(ici, `variantsy-icon-${p}.png`)).toString("base64")}`;
const colonnes = PALETTES.map(
  (p) => `
  <figure>
    <img class="grand" src="${img(p)}">
    <div class="petits">
      <img style="width:64px;height:64px;border-radius:14px" src="${img(p)}">
      <img style="width:32px;height:32px;border-radius:7px" src="${img(p)}">
    </div>
    <figcaption>${LIBELLES[p]}</figcaption>
  </figure>`,
).join("");

await page.setViewportSize({ width: 1800, height: 520 });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; background:#F4F4F6; font:500 17px/1.3 -apple-system, system-ui, sans-serif; color:#303030; }
  main { display:flex; gap:40px; padding:44px; }
  figure { margin:0; display:flex; flex-direction:column; align-items:center; gap:18px; }
  .grand { width:300px; height:300px; border-radius:66px; box-shadow:0 10px 30px rgba(0,0,0,.12); }
  .petits { display:flex; align-items:center; gap:18px; height:64px; }
</style></head><body><main>${colonnes}</main></body></html>`);
await page.screenshot({ path: path.join(ici, "planche-declinaisons.png"), fullPage: true });
console.log("planche-declinaisons.png");
await nav.close();
