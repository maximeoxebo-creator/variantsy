/**
 * Utilitaires partagés client ↔ serveur.
 *
 * ⚠️ Ce fichier ne doit JAMAIS importer de code serveur (Prisma, shopify.server…).
 * Remix ne retire du bundle client que les exports `loader` / `action` /
 * `headers` d'une route ; tout le reste, y compris les imports utilisés par le
 * composant, part chez le navigateur. Mettre `normalize()` dans
 * `settings.server.ts` faisait échouer le build avec
 * « Server-only module referenced by client ».
 */

/** Clé de comparaison insensible à la casse et aux accents. */
export function normalize(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* ==========================================================================
   Moteur de templates de titre

   ⚠️ DUPLICATION ASSUMÉE : la même logique existe en JS vanilla dans
   `extensions/variant-engine/assets/variantsy.js` (fonction `renderTemplate`).
   Impossible de partager le code : l'extension de thème est un asset autonome
   servi par le CDN Shopify, elle ne peut rien importer du bundle Remix.

   Les deux implémentations sont validées par la même table de cas :
   `scripts/template-cases.json`, rejouée par `npm run test`.
   Toute modification ici doit être répercutée là-bas, et inversement.
   ========================================================================== */

/**
 * Résout une variable de template.
 * Accepte `option1`, `option:Couleur` (par nom d'option, insensible à la casse)
 * et les variables simples (`sku`, `vendor`…).
 */
function lookup(vars: Record<string, string>, rawKey: string): string {
  const key = rawKey.trim();
  if (vars[key] !== undefined) return vars[key];
  const lower = normalize(key);
  if (vars[lower] !== undefined) return vars[lower];
  // `option:Couleur` → cherche la clé normalisée
  const match = /^option\s*:\s*(.+)$/i.exec(key);
  if (match) {
    const candidate = "option:" + normalize(match[1]);
    if (vars[candidate] !== undefined) return vars[candidate];
  }
  return "";
}

/**
 * Rend un template de titre.
 *
 * Deux syntaxes :
 *  - `{{variable}}` — substitution simple
 *  - `[[ ... ]]`    — bloc conditionnel : tout le bloc disparaît si l'une des
 *                     variables qu'il contient est vide.
 *
 * Le bloc conditionnel existe pour un problème très concret : un template comme
 * `{{product_title}} — {{option1}} / {{option2}}` produit « Sweat — Bleu / »
 * sur un produit à une seule option. Avec `[[ / {{option2}}]]`, le séparateur
 * disparaît avec la variable. C'est ce que les marchands appellent
 * « logique conditionnelle ».
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  // 1. Blocs conditionnels, résolus avant toute substitution.
  let out = String(template || "").replace(/\[\[([\s\S]*?)\]\]/g, (_, inner: string) => {
    const keys = inner.match(/\{\{\s*[^}]+?\s*\}\}/g) || [];
    const empty = keys.some((token) => {
      const name = token.replace(/^\{\{\s*|\s*\}\}$/g, "");
      return !lookup(vars, name);
    });
    return empty ? "" : inner;
  });

  // 2. Substitution des variables restantes.
  out = out.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => lookup(vars, key));

  // 3. Nettoyage des séparateurs orphelins laissés par une variable vide hors
  //    bloc conditionnel. Volontairement conservateur : on ne touche qu'aux
  //    extrémités et aux doublons, jamais au texte du marchand.
  return out
    .replace(/\s+/g, " ")
    .replace(/([–—\-/|,])\s*(?=[–—\-/|,])/g, "")
    .replace(/^[\s–—\-/|,]+/, "")
    .replace(/[\s–—\-/|,]+$/, "")
    .trim();
}

/** Variables disponibles dans l'éditeur de template, pour l'aide contextuelle. */
export const TEMPLATE_VARIABLES: { token: string; label: string }[] = [
  { token: "{{product_title}}", label: "Nom du produit" },
  { token: "{{variant_title}}", label: "Nom complet de la variante" },
  { token: "{{option1}}", label: "1re option (souvent la couleur)" },
  { token: "{{option2}}", label: "2e option" },
  { token: "{{option3}}", label: "3e option" },
  { token: "{{option:Couleur}}", label: "Option désignée par son nom" },
  { token: "{{price}}", label: "Prix de la variante" },
  { token: "{{compare_at_price}}", label: "Prix barré" },
  { token: "{{sku}}", label: "Référence (SKU)" },
  { token: "{{barcode}}", label: "Code-barres" },
  { token: "{{vendor}}", label: "Fournisseur" },
  { token: "{{product_type}}", label: "Type de produit" },
];
