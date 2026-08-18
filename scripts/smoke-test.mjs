/**
 * Test de fumée du JS storefront (variantsy.js) dans un vrai Chromium.
 *
 * Rejoue des pages produit façon Dawn — galerie + miniatures + sélecteur natif
 * + formulaire d'ajout au panier — et vérifie les comportements qui coûtent des
 * ventes s'ils cassent :
 *
 *   1. Le formulaire reçoit l'ID de la variante sélectionnée
 *   2. Le sélecteur natif reste synchronisé
 *   3. La galerie n'affiche que les médias de la variante active
 *   4. Le titre suit le template marchand
 *   5. Les combinaisons indisponibles sont signalées
 *   6. Une combinaison impossible retombe sur une variante valide
 *   7. Le moteur de templates respecte sa table de cas
 *
 * Usage : node scripts/smoke-test.mjs
 */
import { chromium } from "playwright";
import { computeGroups as adminComputeGroups } from "../app/grouping.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const js = readFileSync(join(root, "storefront/variantsy.js"), "utf8");
const jsCollection = readFileSync(
  join(root, "storefront/variantsy-collection.js"),
  "utf8",
);
const cssCollection = readFileSync(
  join(root, "extensions/variant-engine/assets/variantsy-collection.css"),
  "utf8",
);
const css = readFileSync(join(root, "extensions/variant-engine/assets/variantsy.css"), "utf8");
const templateSuite = JSON.parse(readFileSync(join(root, "scripts/template-cases.json"), "utf8"));
const groupingSuite = JSON.parse(readFileSync(join(root, "scripts/grouping-cases.json"), "utf8"));

/* ========================================================================== */
/* Fixtures                                                                   */
/* ========================================================================== */

const SECTION = "template--1__main";

/** Produit principal : 3 couleurs × 3 tailles, images groupées par couleur. */
const PRODUCT = {
  id: 1,
  title: "Sweat en coton bio",
  url: "/products/sweat",
  vendor: "Atelier Nord",
  type: "Sweat",
  media: [
    // Avant la première image assignée → groupe « commun ».
    { id: 900, i: 0, t: "image", alt: "Guide des tailles", src: "https://example.com/guide.jpg" },
    { id: 11, i: 1, t: "image", alt: "Noir face", src: "https://example.com/noir-1.jpg" },
    { id: 12, i: 2, t: "image", alt: "Noir dos", src: "https://example.com/noir-2.jpg" },
    { id: 22, i: 3, t: "image", alt: "Bleu face", src: "https://example.com/bleu-1.jpg" },
    { id: 23, i: 4, t: "image", alt: "Bleu dos", src: "https://example.com/bleu-2.jpg" },
    { id: 24, i: 5, t: "video", alt: "Bleu en mouvement", src: "https://example.com/bleu-3.jpg" },
    { id: 33, i: 6, t: "image", alt: "Terracotta face", src: "https://example.com/terra-1.jpg" },
  ],
  options: [
    { name: "Couleur", position: 1, values: ["Noir", "Bleu marine", "Terracotta"] },
    { name: "Taille", position: 2, values: ["S", "M", "L"] },
  ],
  variants: [
    v(101, ["Noir", "S"], true, 11),
    v(102, ["Noir", "M"], true, 11),
    v(103, ["Noir", "L"], false, 11),
    v(201, ["Bleu marine", "S"], true, 22),
    v(202, ["Bleu marine", "M"], true, 22),
    v(203, ["Bleu marine", "L"], true, 22),
    // Terracotta n'existe qu'en L : le choisir depuis « M » doit rabattre la
    // taille sur L au lieu de laisser une variante inexistante.
    v(301, ["Terracotta", "L"], true, 33),
  ],
};

/** Aucune image assignée nativement : seul le texte alternatif peut grouper. */
const PRODUCT_ALT_ONLY = {
  ...PRODUCT,
  media: [
    { id: 11, i: 0, t: "image", alt: "Sweat noir face", src: "https://example.com/noir-1.jpg" },
    { id: 12, i: 1, t: "image", alt: "Sweat noir dos", src: "https://example.com/noir-2.jpg" },
    { id: 22, i: 2, t: "image", alt: "Sweat bleu marine face", src: "https://example.com/bleu-1.jpg" },
    { id: 23, i: 3, t: "image", alt: "Sweat bleu marine dos", src: "https://example.com/bleu-2.jpg" },
  ],
  variants: PRODUCT.variants.map((variant) => ({ ...variant, m: null, img: null })),
};

/** Une seule couleur a une image : rien à filtrer, on ne touche à rien. */
const PRODUCT_SINGLE_GROUP = {
  ...PRODUCT,
  media: [
    { id: 11, i: 0, t: "image", alt: "", src: "https://example.com/noir-1.jpg" },
    { id: 12, i: 1, t: "image", alt: "", src: "https://example.com/noir-2.jpg" },
  ],
  variants: PRODUCT.variants.map((variant) => ({
    ...variant,
    m: variant.o[0] === "Noir" ? 11 : null,
    img: null,
  })),
};

function v(id, options, available, mediaId) {
  return {
    id,
    o: options,
    a: available,
    p: "59,00 €",
    cp: null,
    sku: `SKU-${id}`,
    bc: "",
    t: options.join(" / "),
    m: mediaId,
    img: `https://example.com/media-${mediaId}.jpg`,
    imgAlt: options[0],
  };
}

const BASE_CONFIG = {
  v: 1,
  enabled: true,
  style: {
    shape: "circle", size: 40, gap: 10, borderWidth: 1, borderColor: "#D9D9D9",
    selectedStyle: "ring", selectedColor: "#111111", showLabels: false,
    showOptionName: true, maxVisible: 0, customCss: "",
  },
  behavior: {
    soldOutStyle: "strikethrough", hideNativeSelector: true, nativeSelectorCss: "",
    updateUrl: true, preloadOnHover: false, swapImage: true, imageSelectorCss: "",
    updateTitle: true, titleTemplate: "{{product_title}} — {{variant_title}}",
    titleSelectorCss: "", updateDocumentTitle: false,
  },
  gallery: {
    enabled: true, groupBy: "auto", commonMediaMode: "append", altFallback: true,
    altPrefix: "", thumbSelectorCss: "", skipSingleGroup: true,
  },
  colorOptions: ["couleur"],
  swatches: {
    "couleur::noir": { kind: "color", c1: "#111111" },
    "couleur::bleu marine": { kind: "color", c1: "#1F3A5F" },
    "couleur::terracotta": { kind: "color", c1: "#C1614B" },
  },
};

/* ========================================================================== */
/* Construction de la page de test                                            */
/* ========================================================================== */

function groupHtml(option, selected) {
  const buttons = option.values
    .map(
      (value) => `
        <button type="button" class="variantsy__swatch${value === selected[option.position - 1] ? " is-selected" : ""}"
                role="radio" aria-checked="${value === selected[option.position - 1]}"
                data-variantsy-value="${value}" data-option-position="${option.position}">
          <span class="variantsy__visual" aria-hidden="true"></span>
          <span class="variantsy__text">${value}</span>
          <span class="variantsy__caption">${value}</span>
        </button>`,
    )
    .join("");
  return `
    <div class="variantsy__group" data-option-position="${option.position}" data-option-name="${option.name}">
      <div class="variantsy__label">
        <span class="variantsy__label-name">${option.name}</span>
        <span class="variantsy__label-value" data-variantsy-current-value>${selected[option.position - 1]}</span>
      </div>
      <div class="variantsy__options" role="radiogroup">${buttons}</div>
    </div>`;
}

function buildHtml(product, currentVariant) {
  const selected = currentVariant.o;

  const slides = product.media
    .map(
      (media) => `
      <li class="product__media-item" data-media-id="${SECTION}-${media.id}">
        <img src="${media.src}" alt="${media.alt}">
      </li>`,
    )
    .join("");

  const thumbs = product.media
    .map(
      (media) => `
      <li class="thumbnail-list__item">
        <button class="thumbnail" data-target="${SECTION}-${media.id}">
          <img src="${media.src}" alt="${media.alt}">
        </button>
      </li>`,
    )
    .join("");

  const selects = product.options
    .map(
      (option) => `
      <select name="options[${option.name}]" data-index="option${option.position}">
        ${option.values
          .map(
            (value) =>
              `<option value="${value}"${value === selected[option.position - 1] ? " selected" : ""}>${value}</option>`,
          )
          .join("")}
      </select>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${product.title} – Ma Boutique</title><style>${css}</style></head>
<body>
  <main data-section-type="product">
    <media-gallery data-section="${SECTION}" class="product__media-wrapper">
      <ul class="product__media-list">${slides}</ul>
      <!-- Leurre : ID contenant un identifiant connu en suffixe numérique.
           Ne doit JAMAIS être masqué (cf. mediaIdOf / vérification d'appartenance). -->
      <div id="decoy" data-media-id="${SECTION}-4900">leurre</div>
    </media-gallery>
    <div class="thumbnail-list"><ul>${thumbs}</ul></div>

    <div class="product__info-wrapper">
      <h1 class="product__title">${product.title}</h1>

      <variant-selects class="product-variant-picker">${selects}</variant-selects>

      <div class="variantsy" data-variantsy data-product-id="${product.id}"
           data-endpoint="/apps/variantsy/settings" data-current-variant="${currentVariant.id}">
        <script type="application/json" data-variantsy-data>${JSON.stringify(product)}</script>
        ${product.options.map((option) => groupHtml(option, selected)).join("")}
      </div>

      <form action="/cart/add" method="post">
        <input type="hidden" name="id" value="${currentVariant.id}">
        <button type="submit" name="add"><span>Ajouter au panier</span></button>
      </form>
    </div>
  </main>
</body></html>`;
}

/* ========================================================================== */
/* Harnais                                                                    */
/* ========================================================================== */

const results = [];
let currentSection = "";

function section(name) {
  currentSection = name;
}

function check(name, condition, detail) {
  results.push({ section: currentSection, name, ok: Boolean(condition), detail });
}

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const consoleErrors = [];

async function openPage(product, currentVariant, configOverrides = {}) {
  const page = await browser.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  const config = {
    ...BASE_CONFIG,
    behavior: { ...BASE_CONFIG.behavior, ...(configOverrides.behavior || {}) },
    gallery: { ...BASE_CONFIG.gallery, ...(configOverrides.gallery || {}) },
    style: { ...BASE_CONFIG.style, ...(configOverrides.style || {}) },
    ...(configOverrides.colors ? { colors: configOverrides.colors } : {}),
    ...(configOverrides.swatches ? { swatches: configOverrides.swatches } : {}),
  };

  // Playwright évalue les routes de la plus récente à la plus ancienne : la
  // route catch-all doit être posée EN PREMIER, sinon elle intercepterait aussi
  // l'appel à l'app proxy.
  await page.route("https://example.com/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/apps/variantsy/settings", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(config) }),
  );

  await page.goto("https://example.com/products/sweat");
  // sessionStorage est partagé par origine : on le vide pour que chaque scénario
  // reparte de sa propre config et non du cache du scénario précédent.
  await page.evaluate(() => window.sessionStorage.clear());
  await page.setContent(buildHtml(product, currentVariant));
  await page.addScriptTag({ content: js });
  await page.waitForFunction(() => document.querySelector("[data-variantsy-ready]") !== null);
  await page.waitForTimeout(120);
  return page;
}

/** IDs des médias actuellement visibles dans la galerie principale. */
function visibleMedia(page) {
  return page.evaluate((section) =>
    Array.from(document.querySelectorAll(".product__media-list .product__media-item"))
      .filter((el) => !el.classList.contains("variantsy-media-hidden"))
      .map((el) => Number(el.getAttribute("data-media-id").replace(section + "-", ""))),
    SECTION,
  );
}

/** IDs des miniatures visibles (le <li> doit être masqué, pas juste le bouton). */
function visibleThumbs(page) {
  return page.evaluate((section) =>
    Array.from(document.querySelectorAll(".thumbnail-list__item"))
      .filter((el) => !el.classList.contains("variantsy-media-hidden"))
      .map((el) => Number(el.querySelector("[data-target]").getAttribute("data-target").replace(section + "-", ""))),
    SECTION,
  );
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ========================================================================== */
/* Scénario 1 — page produit complète, config par défaut                      */
/* ========================================================================== */

section("Page produit (config par défaut)");
{
  const page = await openPage(PRODUCT, PRODUCT.variants[1]); // Noir / M

  check(
    "Le sélecteur natif est masqué",
    await page.locator("variant-selects").evaluate((el) => el.classList.contains("variantsy-native-hidden")),
  );
  check(
    "Les couleurs de la bibliothèque sont appliquées",
    (await page
      .locator('.variantsy__group[data-option-position="1"] .variantsy__swatch[data-variantsy-value="Bleu marine"] .variantsy__visual')
      .evaluate((el) => getComputedStyle(el).backgroundColor)) === "rgb(31, 58, 95)",
  );
  check(
    "Le titre suit le template dès le chargement",
    (await page.locator("h1.product__title").textContent())?.trim() === "Sweat en coton bio — Noir / M",
  );
  check(
    "Noir / L est signalé indisponible",
    (await page
      .locator('.variantsy__group[data-option-position="2"] .variantsy__swatch[data-variantsy-value="L"]')
      .getAttribute("data-unavailable")) === "true",
  );

  // --- Galerie ------------------------------------------------------------
  check("Le mode galerie est actif", (await page.locator("[data-variantsy]").getAttribute("data-gallery-mode")) === "grouped");

  const noirMedia = await visibleMedia(page);
  check(
    "Groupe Noir : image commune + 2 images du coloris",
    same(noirMedia, [900, 11, 12]),
    JSON.stringify(noirMedia),
  );
  const noirThumbs = await visibleThumbs(page);
  check(
    "Les miniatures suivent le même filtrage (le <li> entier est masqué)",
    same(noirThumbs, [900, 11, 12]),
    JSON.stringify(noirThumbs),
  );
  check(
    "Le leurre 4900 n'est pas masqué par erreur",
    !(await page.locator("#decoy").evaluate((el) => el.classList.contains("variantsy-media-hidden"))),
  );

  // --- Changement de couleur ---------------------------------------------
  await page.locator('.variantsy__swatch[data-variantsy-value="Bleu marine"]').click();
  await page.waitForTimeout(120);

  check(
    "Le formulaire reçoit la bonne variante (Bleu marine / M = 202)",
    (await page.locator('form input[name="id"]').inputValue()) === "202",
  );
  check(
    "Le select natif Couleur est synchronisé",
    (await page.locator('select[name="options[Couleur]"]').inputValue()) === "Bleu marine",
  );
  check(
    "Le titre est mis à jour",
    (await page.locator("h1.product__title").textContent())?.trim() === "Sweat en coton bio — Bleu marine / M",
  );
  check(
    "L'URL porte la variante",
    (await page.evaluate(() => new URL(location.href).searchParams.get("variant"))) === "202",
  );

  const bleuMedia = await visibleMedia(page);
  check(
    "Groupe Bleu marine : 3 médias + l'image commune, vidéo incluse",
    same(bleuMedia, [900, 22, 23, 24]),
    JSON.stringify(bleuMedia),
  );
  check(
    "Les images des autres coloris sont masquées, pas supprimées",
    (await page.locator(`.product__media-item[data-media-id="${SECTION}-11"]`).count()) === 1 &&
      (await page
        .locator(`.product__media-item[data-media-id="${SECTION}-11"]`)
        .evaluate((el) => el.classList.contains("variantsy-media-hidden"))),
  );
  check(
    "Les médias masqués sont aussi retirés aux lecteurs d'écran",
    (await page.locator(`.product__media-item[data-media-id="${SECTION}-11"]`).getAttribute("aria-hidden")) === "true",
  );

  // --- Changement de taille : la galerie ne doit pas bouger ---------------
  await page.locator('.variantsy__group[data-option-position="2"] .variantsy__swatch[data-variantsy-value="S"]').click();
  await page.waitForTimeout(120);
  check(
    "Changer de taille ne change pas la galerie",
    same(await visibleMedia(page), [900, 22, 23, 24]),
  );
  check(
    "…mais met bien à jour la variante (Bleu marine / S = 201)",
    (await page.locator('form input[name="id"]').inputValue()) === "201",
  );

  // --- Combinaison impossible --------------------------------------------
  await page.locator('.variantsy__swatch[data-variantsy-value="Terracotta"]').click();
  await page.waitForTimeout(120);

  check(
    "Terracotta rabat la taille sur L (variante 301)",
    (await page.locator('form input[name="id"]').inputValue()) === "301",
  );
  check(
    "La taille L est marquée sélectionnée dans l'UI",
    await page
      .locator('.variantsy__group[data-option-position="2"] .variantsy__swatch[data-variantsy-value="L"]')
      .evaluate((el) => el.classList.contains("is-selected")),
  );
  check(
    "Groupe Terracotta : une seule image + l'image commune",
    same(await visibleMedia(page), [900, 33]),
  );
  check(
    "Le titre n'accumule pas les concaténations",
    (await page.locator("h1.product__title").textContent())?.trim() === "Sweat en coton bio — Terracotta / L",
  );

  // --- Reset du chrome natif (piège n°5) ----------------------------------
  const appearance = await page
    .locator(".variantsy__swatch")
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return { appearance: style.appearance || style.webkitAppearance, tap: style.webkitTapHighlightColor };
    });
  check("appearance est remis à none", appearance.appearance === "none", JSON.stringify(appearance));
  check(
    "-webkit-tap-highlight-color est transparent",
    appearance.tap === "rgba(0, 0, 0, 0)" || appearance.tap === "transparent",
    appearance.tap,
  );

  await page.close();
}

/* ========================================================================== */
/* Scénario 2 — images communes masquées                                      */
/* ========================================================================== */

section("Images communes masquées");
{
  const page = await openPage(PRODUCT, PRODUCT.variants[1], {
    gallery: { commonMediaMode: "hide" },
  });
  check("Groupe Noir sans l'image commune", same(await visibleMedia(page), [11, 12]));
  await page.locator('.variantsy__swatch[data-variantsy-value="Bleu marine"]').click();
  await page.waitForTimeout(120);
  check("Groupe Bleu sans l'image commune", same(await visibleMedia(page), [22, 23, 24]));
  await page.close();
}

/* ========================================================================== */
/* Scénario 3 — groupage par texte alternatif                                 */
/* ========================================================================== */

section("Repli sur le texte alternatif");
{
  const page = await openPage(PRODUCT_ALT_ONLY, PRODUCT_ALT_ONLY.variants[1]);
  check(
    "Le groupage fonctionne sans aucune image assignée nativement",
    (await page.locator("[data-variantsy]").getAttribute("data-gallery-mode")) === "grouped",
  );
  check("Groupe Noir déduit du texte alternatif", same(await visibleMedia(page), [11, 12]));

  await page.locator('.variantsy__swatch[data-variantsy-value="Bleu marine"]').click();
  await page.waitForTimeout(120);
  check(
    "« bleu marine » l'emporte sur « bleu » (valeur la plus longue)",
    same(await visibleMedia(page), [22, 23]),
  );
  await page.close();
}

/* ========================================================================== */
/* Scénario 4 — un seul groupe : ne rien filtrer                              */
/* ========================================================================== */

section("Produit mal rangé : aucun filtrage");
{
  const page = await openPage(PRODUCT_SINGLE_GROUP, PRODUCT_SINGLE_GROUP.variants[1]);
  check(
    "Le filtrage est désactivé quand un seul groupe existe",
    (await page.locator("[data-variantsy]").getAttribute("data-gallery-mode")) === "off",
  );
  check("Toutes les images restent visibles", same(await visibleMedia(page), [11, 12]));
  check(
    "Le reste de l'app fonctionne quand même (titre)",
    (await page.locator("h1.product__title").textContent())?.trim() === "Sweat en coton bio — Noir / M",
  );
  await page.close();
}

/* ========================================================================== */
/* Scénario 5 — moteur de templates                                           */
/* ========================================================================== */

section("Moteur de templates de titre");
{
  const page = await openPage(PRODUCT, PRODUCT.variants[1]);
  const rendered = await page.evaluate(
    ({ cases, vars }) => cases.map((testCase) => window.Variantsy.renderTemplate(testCase.template, vars)),
    { cases: templateSuite.cases, vars: templateSuite.vars },
  );
  templateSuite.cases.forEach((testCase, index) => {
    check(
      `Template — ${testCase.name}`,
      rendered[index] === testCase.expected,
      `attendu « ${testCase.expected} », obtenu « ${rendered[index]} »`,
    );
  });
  await page.close();
}

/* ========================================================================== */
/* Scénario 6 — moteur de groupage : admin vs storefront                      */
/*                                                                            */
/* Le point critique : l'inspecteur de l'admin (app/grouping.js) et le moteur */
/* storefront (variantsy.js) sont deux implémentations distinctes. Si elles  */
/* divergent, le marchand configure à l'aveugle. On les compare donc cas par  */
/* cas, puis on vérifie le résultat attendu.                                  */
/* ========================================================================== */

section("Moteur de groupage (admin ↔ storefront)");
{
  const page = await openPage(PRODUCT, PRODUCT.variants[1]);
  const cases = groupingSuite.cases.map((testCase) => ({
    ...testCase,
    cfg: { ...groupingSuite.defaultConfig, ...(testCase.config || {}) },
  }));

  const fromBrowser = await page.evaluate(
    (list) => list.map((testCase) => window.Variantsy.computeGroups(testCase.product, testCase.cfg)),
    cases.map(({ product, cfg }) => ({ product, cfg })),
  );

  cases.forEach((testCase, index) => {
    const fromAdmin = adminComputeGroups(testCase.product, testCase.cfg);
    check(
      `${testCase.name} — les deux implémentations concordent`,
      JSON.stringify(fromAdmin) === JSON.stringify(fromBrowser[index]),
      `admin ${JSON.stringify(fromAdmin)} vs storefront ${JSON.stringify(fromBrowser[index])}`,
    );

    if (testCase.expectedNull) {
      check(`${testCase.name} — aucun filtrage`, fromAdmin === null, JSON.stringify(fromAdmin));
      return;
    }
    check(
      `${testCase.name} — groupes attendus`,
      fromAdmin !== null &&
        fromAdmin.index === testCase.expectedIndex &&
        same(fromAdmin.common, testCase.expectedCommon) &&
        same(fromAdmin.groups, testCase.expectedGroups),
      JSON.stringify(fromAdmin),
    );
  });

  await page.close();
}

/* ========================================================================== */
/* Scénario — galerie en carrousel (thèmes façon Savor / Horizon)             */
/*                                                                            */
/* Les scénarios précédents simulent tous une galerie en grille, façon Dawn.  */
/* C'est l'angle mort qui a laissé passer un bug réel : sur un carrousel,     */
/* masquer les diapositives ne suffit pas — le composant garde son propre     */
/* index et continue d'afficher celle qu'on vient de masquer, donc du vide.   */
/* ========================================================================== */

function buildCarouselHtml(product, currentVariant, { withThumbs }) {
  const selected = currentVariant.o;

  const slides = product.media
    .map(
      (media) => `
      <slideshow-slide class="slideshow__slide" data-media-id="${SECTION}-${media.id}">
        <img src="${media.src}" alt="${media.alt}">
      </slideshow-slide>`,
    )
    .join("");

  const thumbs = withThumbs
    ? `<div class="thumbnail-list"><ul>${product.media
        .map(
          (media) => `
        <li class="thumbnail-list__item">
          <button class="thumbnail" data-target="${SECTION}-${media.id}">${media.id}</button>
        </li>`,
        )
        .join("")}</ul></div>`
    : "";

  const selects = product.options
    .map(
      (option) => `
      <select name="options[${option.name}]" data-index="option${option.position}">
        ${option.values
          .map(
            (value) =>
              `<option value="${value}"${value === selected[option.position - 1] ? " selected" : ""}>${value}</option>`,
          )
          .join("")}
      </select>`,
    )
    .join("");

  // Largeurs fixes : le test doit pouvoir comparer scrollLeft et offsetLeft
  // sans dépendre de la mise en page du navigateur.
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${product.title}</title><style>${css}
  .slideshow__track { display: flex; overflow-x: auto; width: 200px; }
  .slideshow__slide { flex: 0 0 200px; width: 200px; height: 120px; }
</style></head>
<body>
  <main data-section-type="product">
    <media-gallery data-section="${SECTION}">
      <slideshow-component>
        <div class="slideshow__track">${slides}</div>
        <ol class="slideshow-controls__dots">${product.media.map(() => "<li></li>").join("")}</ol>
      </slideshow-component>
    </media-gallery>
    ${thumbs}

    <div class="product__info-wrapper">
      <h1 class="product__title">${product.title}</h1>
      <variant-selects class="product-variant-picker">${selects}</variant-selects>

      <div class="variantsy" data-variantsy data-product-id="${product.id}"
           data-endpoint="/apps/variantsy/settings" data-current-variant="${currentVariant.id}">
        <script type="application/json" data-variantsy-data>${JSON.stringify(product)}</script>
        ${product.options.map((option) => groupHtml(option, selected)).join("")}
      </div>

      <form action="/cart/add" method="post">
        <input type="hidden" name="id" value="${currentVariant.id}">
        <button type="submit" name="add"><span>Ajouter au panier</span></button>
      </form>
    </div>
  </main>
</body></html>`;
}

async function openCarouselPage(product, currentVariant, options = {}) {
  const page = await browser.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));

  await page.route("https://example.com/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/apps/variantsy/settings", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(BASE_CONFIG) }),
  );

  await page.goto("https://example.com/products/sweat");
  await page.evaluate(() => window.sessionStorage.clear());
  await page.setContent(buildCarouselHtml(product, currentVariant, options));
  // Espionne les clics de miniature : c'est ainsi qu'on vérifie que le recours
  // n°1 est bien emprunté, plutôt que de deviner à partir du résultat visuel.
  await page.evaluate(() => {
    window.__thumbClicks = [];
    document.querySelectorAll(".thumbnail[data-target]").forEach((button) => {
      button.addEventListener("click", () =>
        window.__thumbClicks.push(button.getAttribute("data-target")),
      );
    });
  });
  await page.addScriptTag({ content: js });
  await page.waitForFunction(() => document.querySelector("[data-variantsy-ready]") !== null);
  await page.waitForTimeout(120);
  return page;
}

section("Galerie en carrousel");
{
  // --- Avec miniatures : le recours n°1 doit être emprunté ------------------
  const page = await openCarouselPage(PRODUCT, PRODUCT.variants[1], { withThumbs: true });

  // Le carrousel est délibérément laissé loin du début : sans repositionnement
  // à faire, l'app ne doit toucher à rien, et il n'y aurait pas de clic à
  // observer. C'est le cas « déjà bien placé », couvert plus bas.
  await page.evaluate(() => {
    document.querySelector(".slideshow__track").scrollLeft = 600;
  });

  const otherColor = PRODUCT.options[0].values.find((v) => v !== PRODUCT.variants[1].o[0]);
  await page.locator(`.variantsy__swatch[data-variantsy-value="${otherColor}"]`).first().click();
  await page.waitForTimeout(150);

  const state = await page.evaluate(() => {
    const slides = Array.from(document.querySelectorAll("slideshow-slide"));
    const firstVisible = slides.find((s) => !s.classList.contains("variantsy-media-hidden"));
    return {
      clicks: window.__thumbClicks,
      firstVisibleId: firstVisible ? firstVisible.getAttribute("data-media-id") : null,
      nbVisibles: slides.filter((s) => !s.classList.contains("variantsy-media-hidden")).length,
      nbTotal: slides.length,
    };
  });

  // Second changement : la galerie est désormais correctement cadrée, donc
  // l'app ne doit plus rien déclencher.
  await page.evaluate(() => {
    window.__thumbClicks = [];
  });
  await page.locator(`.variantsy__swatch[data-variantsy-value="${otherColor}"]`).first().click();
  await page.waitForTimeout(150);
  state.clicsApresCoup = (await page.evaluate(() => window.__thumbClicks)).length;

  check(
    "Le filtrage laisse au moins une diapositive visible",
    state.nbVisibles > 0 && state.nbVisibles < state.nbTotal,
    JSON.stringify(state),
  );
  check(
    "La miniature du premier média visible est activée",
    state.clicks.length > 0 && state.clicks[state.clicks.length - 1] === state.firstVisibleId,
    JSON.stringify(state),
  );
  check(
    "Aucun recours n'est tenté quand le média est déjà en place",
    state.clicsApresCoup === 0,
    JSON.stringify(state),
  );

  await page.close();
}

{
  // --- Sans miniatures : le recours n°3 doit repositionner le défilement ----
  const page = await openCarouselPage(PRODUCT, PRODUCT.variants[1], { withThumbs: false });

  // On place volontairement le carrousel loin du début, comme un visiteur qui
  // aurait fait défiler avant de changer de coloris.
  await page.evaluate(() => {
    document.querySelector(".slideshow__track").scrollLeft = 600;
  });

  const otherColor = PRODUCT.options[0].values.find((v) => v !== PRODUCT.variants[1].o[0]);
  await page.locator(`.variantsy__swatch[data-variantsy-value="${otherColor}"]`).first().click();
  await page.waitForTimeout(200);

  const geometry = await page.evaluate(() => {
    const track = document.querySelector(".slideshow__track");
    const slides = Array.from(document.querySelectorAll("slideshow-slide"));
    const firstVisible = slides.find((s) => !s.classList.contains("variantsy-media-hidden"));
    // On mesure ce que le visiteur voit — l'alignement des bords à l'écran —
    // et non `offsetLeft`, qui se calcule depuis l'ancêtre positionné et
    // masquait justement un décalage laissant une bande vide sur le côté.
    if (!firstVisible) return { ecart: null };
    return {
      ecart: Math.round(
        firstVisible.getBoundingClientRect().left - track.getBoundingClientRect().left,
      ),
      largeurVisible: Math.round(firstVisible.getBoundingClientRect().width),
      largeurPiste: Math.round(track.getBoundingClientRect().width),
    };
  });

  const points = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll(".slideshow-controls__dots > li"));
    const slides = Array.from(document.querySelectorAll("slideshow-slide"));
    return {
      total: dots.length,
      visibles: dots.filter((d) => !d.classList.contains("variantsy-media-hidden")).length,
      slidesVisibles: slides.filter((s) => !s.classList.contains("variantsy-media-hidden")).length,
    };
  });
  check(
    "Les points de pagination suivent les diapositives visibles",
    points.total > points.visibles && points.visibles === points.slidesVisibles,
    JSON.stringify(points),
  );

  check(
    "Le carrousel se repositionne sur le premier média visible",
    geometry.ecart !== null && Math.abs(geometry.ecart) <= 1,
    JSON.stringify(geometry),
  );
  check(
    "La diapositive occupe toute la piste, sans bande vide",
    geometry.largeurVisible === geometry.largeurPiste,
    JSON.stringify(geometry),
  );

  await page.close();
}

/* ========================================================================== */
/* Scénario — repli des pastilles sans couleur associée                       */
/*                                                                            */
/* Sur un catalogue dont toutes les photos se ressemblent, le repli sur        */
/* l'image de variante produit une rangée de vignettes indiscernables au lieu  */
/* d'un nuancier. Le mode « couleur » doit deviner la teinte d'après le nom.   */
/* ========================================================================== */

section("Repli des pastilles");
{
  const dictionnaire = { navy: "#1F3A5F", "bleu marine": "#1F3A5F", noir: "#111111" };
  const valeur = PRODUCT.options[0].values[0];

  // Mode « couleur » : bibliothèque vide, la teinte vient du dictionnaire.
  const page = await openPage(PRODUCT, PRODUCT.variants[1], {
    swatches: {},
    colors: { ...dictionnaire, [valeur.toLowerCase()]: "#1F3A5F" },
    style: { swatchFallback: "color", neutralColor: "#ECECEC" },
  });

  const fond = await page
    .locator(`.variantsy__swatch[data-variantsy-value="${valeur}"] .variantsy__visual`)
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { image: s.backgroundImage, couleur: s.backgroundColor };
    });

  check(
    "Mode couleur : la teinte est devinée depuis le nom",
    fond.couleur === "rgb(31, 58, 95)",
    JSON.stringify(fond),
  );
  check("Mode couleur : aucune photo de variante n'est utilisée", fond.image === "none", JSON.stringify(fond));
  await page.close();

  // Mode « neutre » : jamais d'image, jamais de devinette.
  const page2 = await openPage(PRODUCT, PRODUCT.variants[1], {
    swatches: {},
    style: { swatchFallback: "neutral", neutralColor: "#ABCDEF" },
  });
  const fond2 = await page2
    .locator(`.variantsy__swatch[data-variantsy-value="${valeur}"] .variantsy__visual`)
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { image: s.backgroundImage, couleur: s.backgroundColor };
    });
  check(
    "Mode neutre : la teinte configurée est appliquée",
    fond2.couleur === "rgb(171, 205, 239)" && fond2.image === "none",
    JSON.stringify(fond2),
  );
  await page2.close();

  // Les pastilles photo s'agrandissent, les autres non.
  const pageEchelle = await openPage(PRODUCT, PRODUCT.variants[1], {
    swatches: { "couleur::noir": { kind: "color", c1: "#111111" } },
    style: { swatchFallback: "image", size: 40, photoScale: 200 },
  });
  const tailles = await pageEchelle.evaluate(() => {
    const lire = (valeur) => {
      const v = document.querySelector(
        `.variantsy__swatch[data-variantsy-value="${valeur}"] .variantsy__visual`,
      );
      // Largeur calculée et non boîte englobante : celle-ci ajoute la bordure
      // de chaque côté, ce qui masquerait un écart réel derrière deux pixels.
      return v ? getComputedStyle(v).width : null;
    };
    return { couleurMappee: lire("Noir"), photo: lire("Terracotta") };
  });
  check(
    "Une pastille photo suit l'échelle demandée",
    tailles.photo === "80px",
    JSON.stringify(tailles),
  );
  check(
    "Une pastille de couleur unie garde sa taille",
    tailles.couleurMappee === "40px",
    JSON.stringify(tailles),
  );
  await pageEchelle.close();

  // Mode « image » : comportement historique préservé.
  const page3 = await openPage(PRODUCT, PRODUCT.variants[1], {
    swatches: {},
    style: { swatchFallback: "image" },
  });
  const fond3 = await page3
    .locator(`.variantsy__swatch[data-variantsy-value="${valeur}"] .variantsy__visual`)
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  check("Mode image : le repli historique reste en place", fond3 !== "none", fond3);
  await page3.close();
}

/* ========================================================================== */
/* Scénario — grille dont les vignettes contiennent plus que l'image          */
/*                                                                            */
/* Reproduit la grille desktop du thème Savor : la cellule <li> abrite un      */
/* conteneur d'image ET un badge. Si l'app ne masque que le conteneur, la      */
/* cellule garde sa hauteur et laisse une case blanche à la place de la photo. */
/* ========================================================================== */

function buildGridHtml(product, currentVariant) {
  const selected = currentVariant.o;
  const cells = product.media
    .map(
      (media) => `
      <li class="media-gallery__cell">
        <div class="product-media-container" data-media-id="${SECTION}-${media.id}">
          <img src="${media.src}" alt="${media.alt}">
        </div>
        <span class="media-badge">Nouveau</span>
      </li>`,
    )
    .join("");

  const selects = product.options
    .map(
      (option) => `
      <select name="options[${option.name}]" data-index="option${option.position}">
        ${option.values
          .map(
            (value) =>
              `<option value="${value}"${value === selected[option.position - 1] ? " selected" : ""}>${value}</option>`,
          )
          .join("")}
      </select>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${product.title}</title><style>${css}
  .media-gallery__grid { display: grid; grid-template-columns: 100px 100px; }
  .media-gallery__cell { height: 120px; }
  /* Comme Savor : la cellule de tête occupe toute la largeur. */
  .media-gallery__grid > .media-gallery__cell:first-child { grid-column: span 2; }
</style></head>
<body>
  <main data-section-type="product">
    <media-gallery data-section="${SECTION}">
      <ul class="media-gallery__grid">${cells}</ul>
    </media-gallery>
    <div class="product__info-wrapper">
      <h1 class="product__title">${product.title}</h1>
      <variant-selects class="product-variant-picker">${selects}</variant-selects>
      <div class="variantsy" data-variantsy data-product-id="${product.id}"
           data-endpoint="/apps/variantsy/settings" data-current-variant="${currentVariant.id}">
        <script type="application/json" data-variantsy-data>${JSON.stringify(product)}</script>
        ${product.options.map((option) => groupHtml(option, selected)).join("")}
      </div>
      <form action="/cart/add" method="post">
        <input type="hidden" name="id" value="${currentVariant.id}">
        <button type="submit" name="add"><span>Ajouter au panier</span></button>
      </form>
    </div>
  </main>
</body></html>`;
}

section("Grille à vignettes composites");
{
  const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.route("https://example.com/**", (r) => r.fulfill({ status: 200, body: "" }));
  await page.route("**/apps/variantsy/settings", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(BASE_CONFIG) }),
  );
  await page.goto("https://example.com/products/sweat");
  await page.evaluate(() => window.sessionStorage.clear());
  await page.setContent(buildGridHtml(PRODUCT_ALT_ONLY, PRODUCT_ALT_ONLY.variants[1]));
  await page.addScriptTag({ content: js });
  await page.waitForFunction(() => document.querySelector("[data-variantsy-ready]") !== null);
  await page.waitForTimeout(150);

  const etat = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll(".media-gallery__cell"));
    return {
      cellulesMasquees: cells.filter((c) => c.classList.contains("variantsy-media-hidden")).length,
      cellulesVidesMaisVisibles: cells.filter(
        (c) =>
          !c.classList.contains("variantsy-media-hidden") &&
          c.querySelector(".product-media-container.variantsy-media-hidden"),
      ).length,
      total: cells.length,
    };
  });

  check(
    "C'est la cellule entière qui est masquée, pas seulement l'image",
    etat.cellulesMasquees > 0,
    JSON.stringify(etat),
  );
  check(
    "Aucune cellule vide ne subsiste dans la grille",
    etat.cellulesVidesMaisVisibles === 0,
    JSON.stringify(etat),
  );

  // La cellule de tête d'une grille reçoit souvent un format double largeur via
  // `:first-child`. Comme `display: none` ne change pas qui est le premier
  // enfant, la première photo visible héritait du petit format et partageait sa
  // ligne — le symptôme rapporté sur Savor.
  // On bascule sur un coloris dont le groupe ne contient PAS la cellule de tête :
  // c'est la seule configuration où le bug se manifeste.
  await page.locator('.variantsy__swatch[data-variantsy-value="Bleu marine"]').first().click();
  await page.waitForTimeout(200);

  const tete = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll(".media-gallery__cell"));
    const premiereVisible = cells.find((c) => !c.classList.contains("variantsy-media-hidden"));
    return {
      teteMasquee: cells[0].classList.contains("variantsy-media-hidden"),
      largeurPremiereVisible: premiereVisible
        ? Math.round(premiereVisible.getBoundingClientRect().width)
        : null,
      largeurTeteOrigine: Math.round(cells[0].getBoundingClientRect().width),
    };
  });

  check(
    "La première photo visible reprend le format pleine largeur de la cellule de tête",
    !tete.teteMasquee || tete.largeurPremiereVisible > 150,
    JSON.stringify(tete),
  );

  await page.close();
}

/* ========================================================================== */
/* Scénario — option de couleur nommée autrement que « Couleur »              */
/*                                                                            */
/* La détection reposait sur le seul nom de l'option. Une boutique française   */
/* nommant la sienne « Coloris » — absent de la liste par défaut — obtenait    */
/* des boutons texte au lieu de son nuancier, sans indice sur la cause.        */
/* ========================================================================== */

section("Détection d'une option de couleur");
{
  const PRODUIT_COLORIS = {
    ...PRODUCT,
    options: [
      { name: "Coloris", position: 1, values: ["Noir", "Bleu marine", "Terracotta"] },
      { name: "Taille", position: 2, values: ["S", "M", "L"] },
    ],
  };

  // Bibliothèque renseignée sous la clé « coloris » : c'est le signal le plus
  // fort, et il est disponible quel que soit le mode de repli.
  const page = await openPage(PRODUIT_COLORIS, PRODUIT_COLORIS.variants[1], {
    swatches: {
      "coloris::noir": { kind: "color", c1: "#111111" },
      "coloris::bleu marine": { kind: "color", c1: "#1F3A5F" },
    },
  });

  const classes = await page.evaluate(() => {
    const groups = Array.from(document.querySelectorAll(".variantsy__group"));
    return groups.map((g) => ({
      option: g.getAttribute("data-option-name"),
      couleur: g.classList.contains("variantsy__group--color"),
      texte: g.classList.contains("variantsy__group--text"),
    }));
  });

  const coloris = classes.find((c) => c.option === "Coloris");
  const taille = classes.find((c) => c.option === "Taille");

  check(
    "« Coloris » est reconnu comme une option de couleur",
    coloris?.couleur === true,
    JSON.stringify(classes),
  );
  check(
    "« Taille » reste en boutons texte",
    taille?.texte === true && taille?.couleur === false,
    JSON.stringify(classes),
  );
  await page.close();
}

/* ========================================================================== */
/* Scénario — modes d'affichage des options de couleur                        */
/* ========================================================================== */

section("Modes d'affichage");
{
  // --- Boutons texte : la pastille disparaît, le libellé reste -------------
  const page = await openPage(PRODUCT, PRODUCT.variants[1], {
    style: { displayMode: "text" },
  });
  const texte = await page.evaluate(() => {
    const g = document.querySelector('.variantsy__group[data-option-position="1"]');
    const visual = g.querySelector(".variantsy__visual");
    return {
      classeTexte: g.classList.contains("variantsy__group--text"),
      classeCouleur: g.classList.contains("variantsy__group--color"),
      pastilleVisible: visual ? getComputedStyle(visual).display !== "none" : null,
      libelle: g.querySelector(".variantsy__text")?.textContent?.trim(),
      // Présent dans le DOM ne suffit pas : en mode pastilles il est masqué,
      // et c'est précisément cette confusion qui a rendu le mode texte vide.
      libelleVisible: (() => {
        const t = g.querySelector(".variantsy__text");
        return t ? getComputedStyle(t).display !== "none" : false;
      })(),
    };
  });
  check(
    "Mode texte : l'option couleur passe en boutons, sans pastille",
    texte.classeTexte === true && texte.classeCouleur === false && texte.pastilleVisible === false,
    JSON.stringify(texte),
  );
  check("Mode texte : le nom de la valeur reste lisible", texte.libelle === "Noir", JSON.stringify(texte));
  check(
    "Mode texte : le libellé est réellement affiché, pas seulement présent",
    texte.libelleVisible === true,
    JSON.stringify(texte),
  );
  await page.close();

  // --- Libellés pilotés par l'app, plus par le bloc Liquid -----------------
  const pageLibelles = await openPage(PRODUCT, PRODUCT.variants[1], {
    style: { showLabels: true, showOptionName: false },
  });
  const libelles = await pageLibelles.evaluate(() => {
    const groupe = document.querySelector('.variantsy__group[data-option-position="1"]');
    const label = groupe.querySelector(".variantsy__label");
    const caption = groupe.querySelector(".variantsy__caption");
    return {
      nomOption: label ? getComputedStyle(label).display : null,
      libelleValeur: caption ? getComputedStyle(caption).display : null,
    };
  });
  check(
    "Le nom d'option se masque depuis l'app",
    libelles.nomOption === "none",
    JSON.stringify(libelles),
  );
  check(
    "Le nom de la valeur s'affiche depuis l'app",
    libelles.libelleValeur !== null && libelles.libelleValeur !== "none",
    JSON.stringify(libelles),
  );
  await pageLibelles.close();

  // --- Fond plein sur la case choisie --------------------------------------
  // Deux teintes volontairement opposées : le contraste du texte doit basculer
  // du blanc au noir sans intervention du marchand.
  const pageFonce = await openPage(PRODUCT, PRODUCT.variants[1], {
    style: { displayMode: "text", controlSelectedStyle: "fill", selectedColor: "#111111" },
  });
  const rFonce = await pageFonce
    .locator('.variantsy__swatch[data-variantsy-value="Noir"]')
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { fond: s.backgroundColor, texte: s.color };
    });
  check(
    "Fond plein : la case choisie prend la couleur de sélection",
    rFonce.fond === "rgb(17, 17, 17)",
    JSON.stringify(rFonce),
  );
  check(
    "Fond plein sombre : le texte passe en blanc",
    rFonce.texte === "rgb(255, 255, 255)",
    JSON.stringify(rFonce),
  );
  await pageFonce.close();

  const pageClair = await openPage(PRODUCT, PRODUCT.variants[1], {
    style: { displayMode: "text", controlSelectedStyle: "fill", selectedColor: "#F5E7C8" },
  });
  const rClair = await pageClair
    .locator('.variantsy__swatch[data-variantsy-value="Noir"]')
    .evaluate((el) => getComputedStyle(el).color);
  check(
    "Fond plein clair : le texte passe en noir",
    rClair === "rgb(17, 17, 17)",
    rClair,
  );
  await pageClair.close();

  // --- En mode pastilles, le libellé doit rester masqué --------------------
  const pagePastilles = await openPage(PRODUCT, PRODUCT.variants[1], {
    style: { displayMode: "swatch" },
  });
  const pastilles = await pagePastilles.evaluate(() => {
    const g = document.querySelector('.variantsy__group[data-option-position="1"]');
    const t = g.querySelector(".variantsy__text");
    const v = g.querySelector(".variantsy__visual");
    return {
      libelleMasque: t ? getComputedStyle(t).display === "none" : null,
      pastilleVisible: v ? getComputedStyle(v).display !== "none" : null,
    };
  });
  check(
    "Mode pastilles : le libellé texte reste masqué, la pastille visible",
    pastilles.libelleMasque === true && pastilles.pastilleVisible === true,
    JSON.stringify(pastilles),
  );
  await pagePastilles.close();

  // --- « Aucun » doit vraiment n'appliquer aucun accent aux boutons --------
  const pageSansAccent = await openPage(PRODUCT, PRODUCT.variants[1], {
    style: {
      displayMode: "text",
      controlSelectedStyle: "none",
      selectedColor: "#C1614B",
      borderColor: "#D9D9D9",
    },
  });
  const boutonChoisi = await pageSansAccent
    .locator('.variantsy__swatch[data-variantsy-value="Noir"]')
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { bordure: s.borderTopColor, ombre: s.boxShadow };
    });
  check(
    "Aucun accent : le bouton choisi garde la bordure neutre",
    boutonChoisi.bordure === "rgb(217, 217, 217)",
    JSON.stringify(boutonChoisi),
  );
  check(
    "Aucun accent : aucune ombre intérieure ne subsiste",
    boutonChoisi.ombre === "none",
    JSON.stringify(boutonChoisi),
  );
  await pageSansAccent.close();

  // --- La liste garde une bordure même à épaisseur nulle -------------------
  const pageSansBordure = await openPage(PRODUCT, PRODUCT.variants[1], {
    style: { displayMode: "dropdown", borderWidth: 0, controlSelectedStyle: "outline" },
  });
  const trait = await pageSansBordure
    .locator(".variantsy__select")
    .evaluate((el) => getComputedStyle(el).borderTopWidth);
  check(
    "La liste conserve un trait visible même à épaisseur 0",
    trait === "1px",
    trait,
  );
  await pageSansBordure.close();

  // --- Le liseré doit agir sur la liste, pas seulement sur les boutons ------
  const pageLisere = await openPage(PRODUCT, PRODUCT.variants[1], {
    style: {
      displayMode: "dropdown",
      controlSelectedStyle: "outline",
      selectedColor: "#C1614B",
      borderColor: "#D9D9D9",
    },
  });
  const bordure = await pageLisere
    .locator(".variantsy__select")
    .evaluate((el) => getComputedStyle(el).borderTopColor);
  check(
    "Liseré : la liste déroulante prend la couleur de sélection",
    bordure === "rgb(193, 97, 75)",
    bordure,
  );
  await pageLisere.close();

  const pageAucun = await openPage(PRODUCT, PRODUCT.variants[1], {
    style: {
      displayMode: "dropdown",
      controlSelectedStyle: "none",
      selectedColor: "#C1614B",
      borderColor: "#D9D9D9",
    },
  });
  const neutre = await pageAucun
    .locator(".variantsy__select")
    .evaluate((el) => getComputedStyle(el).borderTopColor);
  check(
    "Aucun accent : la liste garde la bordure neutre",
    neutre === "rgb(217, 217, 217)",
    neutre,
  );
  await pageAucun.close();

  // --- Liste déroulante ----------------------------------------------------
  const page2 = await openPage(PRODUCT, PRODUCT.variants[1], {
    style: { displayMode: "dropdown" },
  });
  const liste = await page2.evaluate(() => {
    const g = document.querySelector('.variantsy__group[data-option-position="1"]');
    const select = g.querySelector(".variantsy__select");
    const options = g.querySelector(".variantsy__options");
    return {
      selectPresent: !!select,
      valeurs: select ? Array.from(select.options).map((o) => o.value) : [],
      selection: select ? select.value : null,
      boutonsMasques: options ? getComputedStyle(options).display === "none" : null,
      // La taille ne doit PAS devenir une liste : le mode ne vise que les couleurs.
      tailleIntacte: !document
        .querySelector('.variantsy__group[data-option-position="2"]')
        .querySelector(".variantsy__select"),
    };
  });
  check(
    "Mode liste : un select est construit pour l'option couleur",
    liste.selectPresent === true && liste.valeurs.length === 3 && liste.selection === "Noir",
    JSON.stringify(liste),
  );
  check("Mode liste : les boutons d'origine sont masqués", liste.boutonsMasques === true, JSON.stringify(liste));
  check("Mode liste : l'option Taille n'est pas transformée", liste.tailleIntacte === true, JSON.stringify(liste));

  // Le select doit réellement changer de variante.
  await page2.selectOption(".variantsy__select", "Bleu marine");
  await page2.waitForTimeout(200);
  const apres = await page2.evaluate(() => ({
    formulaire: document.querySelector('form[action="/cart/add"] input[name="id"]').value,
  }));
  check(
    "Mode liste : choisir dans la liste écrit la bonne variante au panier",
    apres.formulaire === "202",
    JSON.stringify(apres),
  );
  await page2.close();
}

/* ========================================================================== */
/* Scénario — couleurs natives des valeurs d'option (admin Shopify)           */
/*                                                                            */
/* Shopify attache une couleur à chaque valeur d'option. Elle vient du         */
/* marchand lui-même : elle doit primer sur toute devinette, mais céder devant */
/* la bibliothèque de l'app, qui est une correction explicite.                 */
/* ========================================================================== */

section("Couleurs natives Shopify");
{
  const AVEC_NATIF = {
    ...PRODUCT,
    options: [
      {
        name: "Couleur",
        position: 1,
        values: ["Noir", "Bleu marine", "Terracotta"],
        // « Noir » reçoit une teinte native volontairement différente du
        // dictionnaire (#111111) pour que la priorité soit observable.
        sw: ["#445566", null, null],
      },
      { name: "Taille", position: 2, values: ["S", "M", "L"] },
    ],
  };

  // Bibliothèque vide : la couleur native doit s'appliquer.
  const page = await openPage(AVEC_NATIF, AVEC_NATIF.variants[1], {
    swatches: {},
    style: { swatchFallback: "color" },
    colors: { noir: "#111111" },
  });
  const natif = await page
    .locator('.variantsy__swatch[data-variantsy-value="Noir"] .variantsy__visual')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  check(
    "La couleur native Shopify prime sur la devinette par le nom",
    natif === "rgb(68, 85, 102)",
    natif,
  );
  await page.close();

  // Bibliothèque renseignée : elle doit reprendre la main.
  const page2 = await openPage(AVEC_NATIF, AVEC_NATIF.variants[1], {
    swatches: { "couleur::noir": { kind: "color", c1: "#00FF00" } },
    style: { swatchFallback: "color" },
  });
  const biblio = await page2
    .locator('.variantsy__swatch[data-variantsy-value="Noir"] .variantsy__visual')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  check(
    "La bibliothèque du marchand reste prioritaire sur la couleur native",
    biblio === "rgb(0, 255, 0)",
    biblio,
  );
  await page2.close();

  // Une couleur native inexploitable ne doit pas court-circuiter la cascade.
  const INVALIDE = {
    ...AVEC_NATIF,
    options: [
      { name: "Couleur", position: 1, values: ["Noir", "Bleu marine", "Terracotta"], sw: ["ColorDrop", null, null] },
      { name: "Taille", position: 2, values: ["S", "M", "L"] },
    ],
  };
  const pageInv = await openPage(INVALIDE, INVALIDE.variants[1], {
    swatches: {},
    style: { swatchFallback: "color" },
    colors: { noir: "#111111" },
  });
  const repli = await pageInv
    .locator('.variantsy__swatch[data-variantsy-value="Noir"] .variantsy__visual')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  check(
    "Une couleur native inexploitable laisse la cascade se poursuivre",
    repli === "rgb(17, 17, 17)",
    repli,
  );
  await pageInv.close();

  // Une option dont les valeurs portent une couleur native EST une option couleur.
  const AUTRE_NOM = {
    ...AVEC_NATIF,
    options: [
      { name: "Finition", position: 1, values: ["Noir", "Bleu marine", "Terracotta"], sw: ["#445566", null, null] },
      { name: "Taille", position: 2, values: ["S", "M", "L"] },
    ],
  };
  const page3 = await openPage(AUTRE_NOM, AUTRE_NOM.variants[1], { swatches: {} });
  const detecte = await page3.evaluate(() => {
    const g = document.querySelector('.variantsy__group[data-option-position="1"]');
    return g.classList.contains("variantsy__group--color");
  });
  check(
    "Une option nommée « Finition » est reconnue grâce à ses couleurs natives",
    detecte === true,
    String(detecte),
  );
  await page3.close();
}

/* ========================================================================== */
/* Scénario — pastilles sur une page de collection                            */
/*                                                                            */
/* Le thème rend ses vignettes lui-même : aucune app ne peut s'insérer dans    */
/* sa boucle. On repère donc les cartes après coup, et on greffe les pastilles.*/
/* ========================================================================== */

section("Pastilles en collection");
{
  const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.route("https://example.com/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/apps/variantsy/settings", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...BASE_CONFIG, colors: { noir: "#111111" } }),
    }),
  );
  // Shopify sert les données produit sur /products/<handle>.js
  await page.route("**/products/sweat.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        options: [
          { name: "Couleur", values: ["Noir", "Bleu marine", "Terracotta"] },
          { name: "Taille", values: ["S", "M", "L"] },
        ],
        variants: PRODUCT.variants.map((v) => ({
          id: v.id,
          options: v.o,
          featured_image: { src: `https://example.com/variante-${v.id}.jpg` },
        })),
      }),
    }),
  );

  await page.goto("https://example.com/collections/tout");
  await page.evaluate(() => window.sessionStorage.clear());
  await page.setContent(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><style>${cssCollection}</style></head>
<body>
  <!-- Structure imbriquée d'un vrai thème : plusieurs liens vers le même
       produit, à des profondeurs différentes. C'est ce qui produisait trois
       rangées de pastilles par vignette. -->
  <ul class="grille">
    <li class="carte">
      <div class="carte__media">
        <a href="/products/sweat"><img src="https://example.com/carte.jpg" alt="Sweat"></a>
      </div>
      <div class="carte__infos">
        <a href="/products/sweat" class="titre">Sweat en coton bio</a>
        <a href="/products/sweat" class="prix">59,00 €</a>
      </div>
    </li>
  </ul>
  <div data-variantsy-collection-root data-endpoint="/apps/variantsy/settings" hidden></div>
</body></html>`);
  await page.addScriptTag({ content: jsCollection });
  await page.waitForTimeout(600);

  const rendu = await page.evaluate(() => {
    const bloc = document.querySelector("[data-variantsy-collection]");
    if (!bloc) return { present: false };
    const visuels = Array.from(bloc.querySelectorAll(".variantsy-collection__visual"));
    return {
      present: true,
      nbPastilles: visuels.length,
      premiereCouleur: getComputedStyle(visuels[0]).backgroundColor,
      dansLaCarte: !!document.querySelector(".carte [data-variantsy-collection]"),
      nbRangees: document.querySelectorAll("[data-variantsy-collection]").length,
    };
  });

  check(
    "Une rangée de pastilles est greffée dans la carte produit",
    rendu.present === true && rendu.dansLaCarte === true,
    JSON.stringify(rendu),
  );
  check(
    "Une seule rangée, malgré plusieurs liens vers le même produit",
    rendu.nbRangees === 1,
    JSON.stringify(rendu),
  );
  check(
    "Une pastille par coloris, pas par variante",
    rendu.nbPastilles === 3,
    JSON.stringify(rendu),
  );
  check(
    "Les couleurs de la bibliothèque sont appliquées",
    rendu.premiereCouleur === "rgb(17, 17, 17)",
    JSON.stringify(rendu),
  );

  // Le liseré doit rester proportionné : sur une pastille réduite, un anneau
  // à sa taille de page produit occupe un sixième du diamètre.
  const anneau = await page.evaluate(() => {
    const v = document.querySelector(".variantsy-collection__swatch.is-selected .variantsy-collection__visual");
    const conteneur = document.querySelector("[data-variantsy-collection]");
    return {
      taille: getComputedStyle(v).width,
      trait: conteneur.style.getPropertyValue("--vtsy-selected-width"),
      ecart: conteneur.style.getPropertyValue("--vtsy-selected-gap"),
    };
  });
  check(
    "Le liseré est mis à l'échelle avec la pastille",
    anneau.trait === "1px" && anneau.ecart === "1px" && anneau.taille === "22px",
    JSON.stringify(anneau),
  );

  // Cliquer doit changer l'image ET pointer le lien vers la variante.
  await page.locator(".variantsy-collection__swatch").nth(1).click();
  await page.waitForTimeout(200);
  const apresClic = await page.evaluate(() => ({
    image: document.querySelector(".carte img").getAttribute("src"),
    lien: document.querySelector(".carte a").getAttribute("href"),
  }));
  check(
    "Choisir un coloris échange l'image de la carte",
    apresClic.image === "https://example.com/variante-201.jpg",
    JSON.stringify(apresClic),
  );
  check(
    "Le lien de la carte pointe vers la bonne variante",
    apresClic.lien === "/products/sweat?variant=201",
    JSON.stringify(apresClic),
  );

  await page.close();
}

/* ========================================================================== */
/* Bilan                                                                      */
/* ========================================================================== */

section("Santé générale");
check("Aucune erreur JS sur l'ensemble des scénarios", consoleErrors.length === 0, consoleErrors.join(" | "));

await browser.close();

let failed = 0;
let lastSection = null;
for (const result of results) {
  if (result.section !== lastSection) {
    console.log(`\n[1m${result.section}[0m`);
    lastSection = result.section;
  }
  if (!result.ok) failed += 1;
  const mark = result.ok ? "[32m✓[0m" : "[31m✗[0m";
  console.log(`  ${mark} ${result.name}${result.ok || !result.detail ? "" : `\n      → ${result.detail}`}`);
}
console.log(`\n${results.length - failed}/${results.length} tests passés`);
process.exit(failed ? 1 : 0);
