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
const js = readFileSync(join(root, "extensions/variant-engine/assets/variantsy.js"), "utf8");
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
  .media-gallery__cell { height: 120px; }
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
  await page.setContent(buildGridHtml(PRODUCT, PRODUCT.variants[1]));
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
