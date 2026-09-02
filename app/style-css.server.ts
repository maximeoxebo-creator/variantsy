import type { StorefrontConfig } from "./settings.server";

/* ==========================================================================
   Traduction des réglages d'apparence en CSS, côté serveur.

   Pourquoi : le bloc Liquid écrivait en dur `--vtsy-size: 40px` — les valeurs
   d'usine — puis le JavaScript posait celles du marchand une fois la
   configuration arrivée. Une boutique réglée à 20 px affichait donc ses
   pastilles au double avant de les voir rétrécir, et la mise en page sautait.

   En publiant ce CSS dans une métadonnée de boutique, le bloc le rend du
   premier coup : plus de saut, et plus rien à attendre pour l'habillage.
   ========================================================================== */

type Style = StorefrontConfig["style"];

/** Le libellé se mesure en em : il suit ainsi la typographie du thème au lieu
 *  d'imposer des pixels qui jurent sur une fiche éditoriale. */
const TAILLES: Record<string, string> = {
  s: "1em",
  m: "1.25em",
  l: "1.5em",
  // Les thèmes marchands titrent souvent bien plus haut que le corps de texte :
  // l'échelle plafonnait trop bas pour les rejoindre.
  xl: "1.85em",
};

/** Noir ou blanc, selon ce qui se lit le mieux sur la couleur donnée.
 *  Reprend le calcul du storefront : les deux doivent tomber d'accord, sinon
 *  le texte changerait de couleur au chargement. */
function contrasteSur(couleur: string): string {
  const hex = String(couleur || "#111111").trim().replace("#", "");
  const plein =
    hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(plein, 16);
  if (!Number.isFinite(n)) return "#ffffff";
  const r = (n >> 16) & 255;
  const v = (n >> 8) & 255;
  const b = n & 255;
  // Luminance perçue : l'œil est bien plus sensible au vert qu'au bleu.
  return (r * 299 + v * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff";
}

/** Arrondi des CASES — boutons texte et liste déroulante.
 *
 *  Il suivait son propre réglage, indépendant de la forme des pastilles : un
 *  marchand qui choisissait « carré » gardait des cases en gélules, et les deux
 *  rangées d'une même fiche ne se ressemblaient pas. La forme commande
 *  désormais, sauf en mode rond où une case ronde n'aurait aucun sens : là, le
 *  réglage du marchand reprend la main. */
function rayonCase(style: Style): number {
  if (style.shape === "square") return 0;
  if (style.shape === "rounded") return style.cornerRadius ?? 8;
  return style.controlRadius ?? 6;
}

function rayon(style: Style): string {
  if (style.shape === "square") return "0px";
  if (style.shape === "rounded") return `${style.cornerRadius ?? 8}px`;
  return "50%";
}

/** Une couleur laissée sur « auto » n'est PAS écrite : la feuille de style la
 *  dérive alors de currentColor, donc de la couleur de texte du thème. */
export const estAuto = (v: string | undefined | null) =>
  !v || v.trim().toLowerCase() === "auto";

/** Les mêmes variables que `appliquerHabillage()` côté storefront. */
export function styleEnCss(style: Style): string {
  const taille = style.size ?? 40;
  const echelle = style.photoScale ?? 100;
  return [
    `--vtsy-size:${taille}px`,
    `--vtsy-gap:${style.gap ?? 10}px`,
    `--vtsy-border-width:${style.borderWidth ?? 1}px`,
    ...(estAuto(style.borderColor) ? [] : [`--vtsy-border-color:${style.borderColor}`]),
    ...(estAuto(style.selectedColor) ? [] : [`--vtsy-selected-color:${style.selectedColor}`]),
    `--vtsy-selected-width:${style.selectedWidth ?? 2}px`,
    `--vtsy-selected-gap:${style.selectedGap ?? 2}px`,
    `--vtsy-control-radius:${rayonCase(style)}px`,
    `--vtsy-photo-size:${Math.round((taille * echelle) / 100)}px`,
    ...(estAuto(style.selectedColor)
      ? []
      : [`--vtsy-selected-contrast:${contrasteSur(style.selectedColor)}`]),
    `--vtsy-control-width:${style.dropdownFullWidth ? "100%" : "auto"}`,
    `--vtsy-radius:${rayon(style)}`,
    `--vtsy-label-weight:${style.labelValueBold ? "600" : "inherit"}`,
    `--vtsy-label-size:${TAILLES[style.labelSize] ?? "1.5em"}`,
    `--vtsy-label-name-weight:${style.labelNameBold === false ? "inherit" : "600"}`,
  ].join(";");
}

/** Ce que le bloc lit dans `shop.metafields.variantsy.style`. */
export type StylePublie = {
  css: string;
  cssLinked: string;
  selectedStyle: string;
  controlSelected: string;
  /** L'accent suit-il le thème ? Pilote la teinte douce du mode « fill ». */
  autoAccent: boolean;
  showLabels: boolean;
  showOptionName: boolean;
  soldOut: string;
};

export function stylePublie(config: StorefrontConfig): StylePublie {
  return {
    css: styleEnCss(config.style),
    // Vide quand le marchand n'a rien détaché : le bloc n'écrit alors rien sur
    // la rangée liée, qui hérite de la racine par la cascade.
    cssLinked: config.styleLinked ? styleEnCss(config.styleLinked) : "",
    selectedStyle: config.style.selectedStyle,
    controlSelected: config.style.controlSelectedStyle || "outline",
    autoAccent: estAuto(config.style.selectedColor),
    showLabels: Boolean(config.style.showLabels),
    showOptionName: Boolean(config.style.showOptionName),
    soldOut: config.behavior.soldOutStyle,
  };
}
