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

function rayon(style: Style): string {
  if (style.shape === "square") return "0px";
  if (style.shape === "rounded") return `${style.cornerRadius ?? 8}px`;
  return "50%";
}

/** Les mêmes variables que `appliquerHabillage()` côté storefront. */
export function styleEnCss(style: Style): string {
  const taille = style.size ?? 40;
  const echelle = style.photoScale ?? 100;
  return [
    `--vtsy-size:${taille}px`,
    `--vtsy-gap:${style.gap ?? 10}px`,
    `--vtsy-border-width:${style.borderWidth ?? 1}px`,
    `--vtsy-border-color:${style.borderColor}`,
    `--vtsy-selected-color:${style.selectedColor}`,
    `--vtsy-selected-width:${style.selectedWidth ?? 2}px`,
    `--vtsy-selected-gap:${style.selectedGap ?? 2}px`,
    `--vtsy-control-radius:${style.controlRadius ?? 6}px`,
    `--vtsy-photo-size:${Math.round((taille * echelle) / 100)}px`,
    `--vtsy-selected-contrast:${contrasteSur(style.selectedColor)}`,
    `--vtsy-control-width:${style.dropdownFullWidth ? "100%" : "auto"}`,
    `--vtsy-radius:${rayon(style)}`,
  ].join(";");
}

/** Ce que le bloc lit dans `shop.metafields.variantsy.style`. */
export type StylePublie = {
  css: string;
  cssLinked: string;
  selectedStyle: string;
  controlSelected: string;
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
    showLabels: Boolean(config.style.showLabels),
    showOptionName: Boolean(config.style.showOptionName),
    soldOut: config.behavior.soldOutStyle,
  };
}
