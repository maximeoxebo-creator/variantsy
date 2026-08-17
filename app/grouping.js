/**
 * Groupage des médias par variante — portage ESM du moteur storefront.
 *
 * ⚠️ DUPLICATION ASSUMÉE avec `extensions/variant-engine/assets/variantsy.js`.
 *    L'extension de thème est un asset autonome servi par le CDN Shopify : elle
 *    ne peut rien importer du bundle Remix, et réciproquement.
 *
 *    Le garde-fou : `npm run test` exécute les deux implémentations sur la même
 *    table de cas (`scripts/grouping-cases.json`) et compare leurs sorties.
 *    Si l'une dérive, le test casse. Sans cela, l'inspecteur de l'admin
 *    montrerait au marchand un groupage différent de celui que voient ses
 *    clients — le pire type de bug pour le support.
 *
 * Ce fichier est volontairement du JavaScript pur (pas du TypeScript) et
 * autonome : il doit pouvoir être importé aussi bien par Vite/Remix que
 * directement par Node dans le test.
 */

/** Clé de comparaison insensible à la casse et aux accents. */
export function normalize(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Recherche avec frontières de mot. Indispensable : la valeur d'option « S » se
 * trouverait dans « Sweat » avec un simple `indexOf`.
 */
export function containsToken(haystack, needle) {
  if (!haystack || !needle) return false;
  let from = 0;
  let index;
  while ((index = haystack.indexOf(needle, from)) !== -1) {
    const before = index === 0 ? "" : haystack.charAt(index - 1);
    const after = haystack.charAt(index + needle.length);
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
    from = index + 1;
  }
  return false;
}

/** Médias rattachés à une valeur d'option d'après leur texte alternatif. */
export function altOwners(product, index, cfg) {
  const option = (product.options || [])[index];
  if (!option) return {};

  const prefix = normalize(cfg.altPrefix || "");
  const owners = {};

  (product.media || []).forEach((media) => {
    const alt = normalize(media.alt);
    if (!alt) return;
    let matched = null;
    option.values.forEach((value) => {
      if (!containsToken(alt, prefix + normalize(value))) return;
      if (!matched || value.length > matched.length) matched = value;
    });
    if (matched) owners[media.id] = matched;
  });

  return owners;
}

/** Option porteuse du groupage, ou -1 s'il ne faut rien filtrer. */
export function resolveGroupIndex(product, cfg) {
  const options = product.options || [];
  const explicit = cfg.groupBy;
  if (/^option[123]$/.test(explicit)) {
    const forced = Number(explicit.slice(-1)) - 1;
    return forced < options.length ? forced : -1;
  }

  const variants = product.variants || [];
  let best = -1;
  let bestScore = 0;

  for (let i = 0; i < options.length; i++) {
    const seen = {};
    let conflict = false;
    let distinct = 0;

    for (let v = 0; v < variants.length; v++) {
      const variant = variants[v];
      if (!variant.m) continue;
      const value = variant.o[i];
      if (seen[value] === undefined) {
        seen[value] = variant.m;
        distinct += 1;
      } else if (seen[value] !== variant.m) {
        conflict = true;
        break;
      }
    }

    if (!conflict && distinct > bestScore) {
      bestScore = distinct;
      best = i;
    }
  }

  if (bestScore >= 2) return best;
  if (!cfg.altFallback) return -1;

  for (let j = 0; j < options.length; j++) {
    const owners = altOwners(product, j, cfg);
    const values = {};
    let count = 0;
    Object.keys(owners).forEach((mediaId) => {
      if (values[owners[mediaId]]) return;
      values[owners[mediaId]] = true;
      count += 1;
    });
    if (count > bestScore) {
      bestScore = count;
      best = j;
    }
  }

  return bestScore >= 2 ? best : -1;
}

/**
 * Construit les groupes d'images. Retourne null quand il ne faut RIEN filtrer.
 * Voir le commentaire détaillé dans `variantsy.js` — les deux fonctions sont
 * strictement équivalentes.
 */
export function computeGroups(product, cfg) {
  const media = product.media || [];
  if (!cfg.enabled || !media.length) return null;

  const index = resolveGroupIndex(product, cfg);
  if (index < 0) return null;

  const owners = {};
  (product.variants || []).forEach((variant) => {
    if (variant.m && owners[variant.m] === undefined) owners[variant.m] = variant.o[index];
  });

  if (cfg.altFallback) {
    const fromAlt = altOwners(product, index, cfg);
    Object.keys(fromAlt).forEach((mediaId) => {
      if (owners[mediaId] === undefined) owners[mediaId] = fromAlt[mediaId];
    });
  }

  const groups = {};
  const common = [];
  const order = [];
  let current = null;

  media.forEach((item) => {
    order.push(item.id);
    if (owners[item.id] !== undefined) current = owners[item.id];
    if (current === null) {
      common.push(item.id);
      return;
    }
    if (!groups[current]) groups[current] = [];
    groups[current].push(item.id);
  });

  const keys = Object.keys(groups);
  if (!keys.length) return null;
  if (cfg.skipSingleGroup && keys.length < 2) return null;

  return { index, groups, common, order, firstKey: keys[0] };
}

/** Ensemble des médias visibles pour une valeur d'option, ou null. */
export function visibleMediaFor(groupsResult, value, cfg) {
  if (!groupsResult) return null;
  const list = groupsResult.groups[value];
  if (!list || !list.length) return null;

  const visible = {};
  list.forEach((id) => {
    visible[id] = true;
  });

  const mode = cfg.commonMediaMode;
  if (mode === "append" || (mode === "first" && value === groupsResult.firstKey)) {
    groupsResult.common.forEach((id) => {
      visible[id] = true;
    });
  }
  return visible;
}

export const DEFAULT_GALLERY_CONFIG = {
  enabled: true,
  groupBy: "auto",
  commonMediaMode: "append",
  altFallback: true,
  altPrefix: "",
  thumbSelectorCss: "",
  skipSingleGroup: true,
};
