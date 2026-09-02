/**
 * Dictionnaire de noms de couleurs → hex, FR + EN.
 * Sert à pré-remplir la bibliothèque de swatches à l'import : le marchand
 * n'a plus qu'à corriger les cas exotiques au lieu de tout saisir à la main.
 * C'est la différence entre une app qu'on configure en 30 secondes et une app
 * qu'on abandonne.
 */
export const COLOR_DICTIONARY: Record<string, string> = {
  // Neutres
  noir: "#111111", black: "#111111",
  blanc: "#FFFFFF", white: "#FFFFFF",
  "blanc casse": "#F5F1E8", ivory: "#F5F1E8", ivoire: "#F5F1E8",
  ecru: "#F0EAD6", cream: "#F5F0E1", creme: "#F5F0E1",
  gris: "#8E8E8E", grey: "#8E8E8E", gray: "#8E8E8E",
  "gris clair": "#C9C9C9", "light grey": "#C9C9C9", "light gray": "#C9C9C9",
  "gris fonce": "#4A4A4A", "dark grey": "#4A4A4A", "dark gray": "#4A4A4A",
  anthracite: "#333333", charcoal: "#36454F",
  taupe: "#8B7E74", beige: "#D8C3A5", sable: "#E3D5B8", sand: "#E3D5B8",
  nude: "#E3BC9A", camel: "#C19A6B",

  // Bleus
  bleu: "#2C5AA0", blue: "#2C5AA0",
  "bleu marine": "#1F3A5F", marine: "#1F3A5F", navy: "#1F3A5F",
  "bleu ciel": "#87CEEB", "sky blue": "#87CEEB",
  "bleu roi": "#1E40AF", "royal blue": "#1E40AF",
  turquoise: "#40E0D0", cyan: "#22D3EE", petrole: "#1B4B5A", teal: "#14807F",
  indigo: "#4B0082", denim: "#3B5C87",

  // Verts
  vert: "#2E7D32", green: "#2E7D32",
  "vert olive": "#708238", olive: "#708238",
  "vert kaki": "#6B6B47", kaki: "#6B6B47", khaki: "#6B6B47",
  "vert sapin": "#0B3D2E", "forest green": "#0B3D2E",
  "vert menthe": "#98D8C8", mint: "#98D8C8", menthe: "#98D8C8",
  "vert amande": "#C5D9A0", sauge: "#9CAF88", sage: "#9CAF88",
  lime: "#A3C93A",

  // Rouges / roses
  rouge: "#C62828", red: "#C62828",
  bordeaux: "#6D1F2C", burgundy: "#6D1F2C", wine: "#6D1F2C",
  rose: "#F48FB1", pink: "#F48FB1",
  "rose poudre": "#EBC7C2", "dusty pink": "#EBC7C2", blush: "#EBC7C2",
  fuchsia: "#D6006E", magenta: "#C2185B",
  corail: "#FF7F50", coral: "#FF7F50",
  terracotta: "#C1614B", brique: "#9E4638", brick: "#9E4638",
  framboise: "#B3204D", raspberry: "#B3204D",

  // Jaunes / oranges
  jaune: "#F9C74F", yellow: "#F9C74F",
  moutarde: "#C9A227", mustard: "#C9A227",
  orange: "#E8722C",
  ocre: "#CC7722", ochre: "#CC7722",
  or: "#D4AF37", gold: "#D4AF37", dore: "#D4AF37",

  // Violets / marrons
  violet: "#7B4397", purple: "#7B4397",
  lilas: "#C8A2C8", lilac: "#C8A2C8", lavande: "#B39DDB", lavender: "#B39DDB",
  prune: "#6E2C4B", plum: "#6E2C4B",
  marron: "#6B4423", brown: "#6B4423",
  chocolat: "#4A2C17", chocolate: "#4A2C17",
  cognac: "#9A5B34", caramel: "#B87333",

  // Métaux
  argent: "#C0C0C0", silver: "#C0C0C0",
  // Finitions métalliques : très courantes en électroménager et en ustensile,
  // et absentes jusqu'ici — « inox » retombait sur un doré par accident.
  inox: "#C4C8CC", acier: "#B7BCC2", steel: "#B7BCC2", chrome: "#CBD1D6",
  aluminium: "#C9CDD1", metal: "#B9BEC4", brosse: "#BFC4C9", brushed: "#BFC4C9",
  bronze: "#8C7853", cuivre: "#B87333", copper: "#B87333",
};

import { normalize } from "./shared";

/** Cherche une couleur par nom, avec repli sur une correspondance partielle. */
export function guessColor(label: string): string | null {
  const key = normalize(label);

  if (COLOR_DICTIONARY[key]) return COLOR_DICTIONARY[key];

  // "Bleu marine chiné" → on retient la plus longue clé contenue dans le label,
  // pour que "bleu marine" l'emporte sur "bleu".
  // La recherche se fait sur des MOTS ENTIERS. En sous-chaîne libre, « or »
  // se trouvait dans « collectors » et peignait en doré une poubelle inox.
  // Le storefront, lui, a toujours exigé des limites de mot : les deux
  // moteurs se contredisaient, et la pastille changeait de couleur au
  // chargement — le clignotement qu'on s'est efforcé de supprimer.
  const motEntier = (texte: string, mot: string) => {
    let i = texte.indexOf(mot);
    while (i !== -1) {
      const avant = i === 0 ? "" : texte.charAt(i - 1);
      const apres = texte.charAt(i + mot.length);
      if (!/[a-z0-9]/.test(avant) && !/[a-z0-9]/.test(apres)) return true;
      i = texte.indexOf(mot, i + 1);
    }
    return false;
  };

  let best: { hex: string; length: number } | null = null;
  for (const [name, hex] of Object.entries(COLOR_DICTIONARY)) {
    if (motEntier(key, name) && (!best || name.length > best.length)) {
      best = { hex, length: name.length };
    }
  }
  return best?.hex ?? null;
}
