/* ==========================================================================
   Variantsy — logique storefront
   Vanilla JS, aucune dépendance, aucun framework. Chargé sur chaque page
   produit : chaque kilo-octet compte.

   ⚠️ PIÈGE N°1 (voir CLAUDE.md) : ce fichier n'est PAS déployé par `git push`.
      Après modification : `npm run test` puis `npm run deploy:extension`.

   Trois fonctionnalités, par ordre d'importance commerciale :
     1. GALERIE — plusieurs images par variante. Shopify n'en autorise qu'une
        nativement ; on regroupe les médias et on filtre la galerie du thème.
     2. TITRE   — réécriture du titre produit selon un template marchand.
     3. SWATCHES— sélecteur de variantes en pastilles.

   Principes de robustesse (un bug ici = des ventes perdues) :
    - Tout est enveloppé dans des try/catch : une erreur ne doit jamais casser
      le bouton « Ajouter au panier » du thème.
    - Le sélecteur natif est piloté, pas remplacé. On écrit toujours dans
      l'input `[name="id"]` du formulaire : même si le thème ignore nos events,
      le panier reçoit la bonne variante.
    - On MASQUE des médias, on n'en supprime jamais : le zoom, la lightbox et
      les vidéos du thème continuent de fonctionner sur les nœuds d'origine.
    - En cas de doute (groupage incohérent, aucun média assigné), on n'agit pas.
      Une galerie complète vaut mieux qu'une galerie amputée à tort.
   ========================================================================== */

(function () {
  "use strict";

  // Incrémenté à chaque changement de forme du payload : sans ça, un navigateur
  // qui a déjà la config en cache continuerait 5 minutes durant à travailler
  // avec une version dépourvue des nouvelles clés de style.
  var CACHE_KEY = "variantsy:config:v3";
  var CACHE_TTL = 5 * 60 * 1000; // 5 min côté navigateur, 60 s côté CDN
  var HIDDEN_CLASS = "variantsy-media-hidden";

  var DEFAULT_CONFIG = {
    v: 1,
    enabled: true,
    style: {
      shape: "circle",
      size: 40,
      gap: 10,
      borderWidth: 1,
      borderColor: "#D9D9D9",
      selectedStyle: "ring",
      selectedColor: "#111111",
      selectedWidth: 2,
      selectedGap: 2,
      cornerRadius: 8,
      displayMode: "swatch",
      controlRadius: 6,
      controlSelectedStyle: "outline",
      dropdownFullWidth: false,
      swatchFallback: "image",
      photoScale: 100,
      neutralColor: "#ECECEC",
      showLabels: false,
      showOptionName: true,
      maxVisible: 0,
      customCss: "",
    },
    behavior: {
      soldOutStyle: "strikethrough",
      hideNativeSelector: true,
      nativeSelectorCss: "",
      updateUrl: true,
      preloadOnHover: true,
      swapImage: true,
      imageSelectorCss: "",
      updateTitle: true,
      titleTemplate: "{{product_title}} — {{variant_title}}",
      titleSelectorCss: "",
      updateDocumentTitle: false,
    },
    gallery: {
      enabled: true,
      groupBy: "auto",
      commonMediaMode: "append",
      altFallback: true,
      altPrefix: "",
      thumbSelectorCss: "",
      skipSingleGroup: true,
    },
    colorOptions: ["color", "colour", "couleur", "farbe", "kleur", "colore"],
    swatches: {},
  };

  /* ---------------------------------------------------------------------- */
  /* Utilitaires                                                            */
  /* ---------------------------------------------------------------------- */

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  /**
   * Nombre s\u00fbr pour construire une longueur CSS.
   *
   * Une config servie par une version ant\u00e9rieure de l'app \u2014 ou rest\u00e9e en cache
   * dans le navigateur \u2014 n'a pas les cl\u00e9s r\u00e9centes. Sans ce garde-fou,
   * `undefined + "px"` produit \u00ab undefinedpx \u00bb, que le navigateur rejette en
   * silence : la r\u00e8gle enti\u00e8re est ignor\u00e9e et le style part en vrille sans la
   * moindre erreur en console.
   */
  function num(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  /**
   * Noir ou blanc, selon ce qui se lit le mieux sur la couleur donnée.
   *
   * Le marchand choisit librement sa teinte de sélection ; écrire en blanc
   * par défaut rendrait le libellé illisible sur un jaune ou un beige. On
   * mesure donc la luminance perçue plutôt que de parier.
   */
  function contrasteSur(couleur) {
    var hex = String(couleur || "#111111").trim();
    var court = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
    if (court) hex = "#" + court[1] + court[1] + court[2] + court[2] + court[3] + court[3];
    var m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return "#ffffff";
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255;
    var v = (n >> 8) & 255;
    var b = n & 255;
    // Coefficients de luminance perçue (Rec. 601), suffisants ici.
    return (r * 299 + v * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff";
  }

  /**
   * La valeur est-elle une couleur que le navigateur saura appliquer ?
   *
   * Ce garde-fou existe parce que son absence a coûté cher : la couleur native
   * de Shopify était appliquée sans contrôle, et la fonction s'arrêtait là.
   * Une valeur inexploitable donnait donc une pastille grise ET privait la
   * suite de la cascade — ni devinette, ni photo de variante. Une source de
   * données qu'on ne contrôle pas doit être validée avant d'être crue.
   */
  function estCouleurCss(value) {
    if (!value) return null;
    var texte = String(value).trim();
    if (/^#[0-9a-f]{3,8}$/i.test(texte)) return texte;
    if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/i.test(texte))
      return texte;
    if (/^hsla?\(/i.test(texte) && texte.indexOf(")") !== -1) return texte;
    return null;
  }

  /**
   * Devine une couleur d'après le nom de la valeur.
   *
   * Miroir exact de `guessColor()` dans app/colors.ts — la duplication est
   * imposée par l'architecture (l'extension ne peut rien importer du bundle
   * Remix), et le dictionnaire lui-même n'est PAS dupliqué : il arrive dans la
   * config servie par l'app proxy.
   *
   * On retient la clé la plus longue contenue dans le nom, pour que
   * « bleu marine » l'emporte sur « bleu » dans « Bleu marine chiné ».
   */
  function guessColorFrom(dictionary, label) {
    if (!dictionary) return null;
    var key = normalize(label);
    if (dictionary[key]) return dictionary[key];

    var best = null;
    var bestLength = 0;
    for (var name in dictionary) {
      if (!Object.prototype.hasOwnProperty.call(dictionary, name)) continue;
      if (key.indexOf(name) !== -1 && name.length > bestLength) {
        best = dictionary[name];
        bestLength = name.length;
      }
    }
    return best;
  }

  /**
   * Recherche d'un terme dans un texte, avec frontières de mot.
   *
   * Un simple `indexOf` est inutilisable ici : la valeur d'option « S » se
   * trouverait dans « Sweat », et l'app croirait que toutes les photos
   * appartiennent à la taille S. On exige donc que le terme ne soit ni précédé
   * ni suivi d'un caractère alphanumérique.
   */
  function containsToken(haystack, needle) {
    if (!haystack || !needle) return false;
    var from = 0;
    var index;
    while ((index = haystack.indexOf(needle, from)) !== -1) {
      var before = index === 0 ? "" : haystack.charAt(index - 1);
      var after = haystack.charAt(index + needle.length);
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
      from = index + 1;
    }
    return false;
  }

  function deepMerge(base, override) {
    var out = {};
    Object.keys(base).forEach(function (key) {
      var b = base[key];
      var o = override ? override[key] : undefined;
      if (b && typeof b === "object" && !Array.isArray(b)) {
        out[key] = deepMerge(b, o || {});
      } else {
        out[key] = o === undefined || o === null ? b : o;
      }
    });
    if (override) {
      Object.keys(override).forEach(function (key) {
        if (!(key in out)) out[key] = override[key];
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------------- */
  /* Moteur de templates de titre                                           */
  /*                                                                        */
  /* ⚠️ DUPLICATION ASSUMÉE avec `app/shared.ts` (renderTemplate).           */
  /*    L'extension de thème est un asset autonome servi par le CDN Shopify :*/
  /*    elle ne peut rien importer du bundle Remix. Les deux implémentations */
  /*    sont validées par la même table de cas, `scripts/template-cases.json`,*/
  /*    rejouée par `npm run test`. Modifier l'une = modifier l'autre.       */
  /* ---------------------------------------------------------------------- */

  function lookupVar(vars, rawKey) {
    var key = String(rawKey).trim();
    if (vars[key] !== undefined) return vars[key];
    var lower = normalize(key);
    if (vars[lower] !== undefined) return vars[lower];
    var match = /^option\s*:\s*(.+)$/i.exec(key);
    if (match) {
      var candidate = "option:" + normalize(match[1]);
      if (vars[candidate] !== undefined) return vars[candidate];
    }
    return "";
  }

  function renderTemplate(template, vars) {
    var out = String(template || "").replace(/\[\[([\s\S]*?)\]\]/g, function (_, inner) {
      var tokens = inner.match(/\{\{\s*[^}]+?\s*\}\}/g) || [];
      var empty = tokens.some(function (token) {
        return !lookupVar(vars, token.replace(/^\{\{\s*|\s*\}\}$/g, ""));
      });
      return empty ? "" : inner;
    });

    out = out.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_, key) {
      return lookupVar(vars, key);
    });

    return out
      .replace(/\s+/g, " ")
      .replace(/([–—\-/|,])\s*(?=[–—\-/|,])/g, "")
      .replace(/^[\s–—\-/|,]+/, "")
      .replace(/[\s–—\-/|,]+$/, "")
      .trim();
  }

  /* ---------------------------------------------------------------------- */
  /* Configuration                                                          */
  /* ---------------------------------------------------------------------- */

  function readCache() {
    try {
      var raw = window.sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.t > CACHE_TTL) return null;
      return parsed.d;
    } catch (error) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: data }));
    } catch (error) {
      /* quota plein ou navigation privée : sans importance */
    }
  }

  /**
   * Charge la configuration marchand depuis l'app proxy.
   * Retourne TOUJOURS une config exploitable : en cas d'échec réseau ou de
   * base endormie (cold-start Neon, piège n°3), on repart des valeurs par
   * défaut plutôt que de ne rien afficher.
   */
  function loadConfig(endpoint) {
    var cached = readCache();
    if (cached) return Promise.resolve(deepMerge(DEFAULT_CONFIG, cached));

    // Requête déjà lancée par le bloc, avant même le téléchargement de ce
    // fichier. Deux moteurs cohabitent sur une page produit — celui-ci et celui
    // des collections — et ils partaient chacun chercher la configuration : la
    // page émettait trois requêtes au lieu d'une, la dernière rendant la main
    // après une seconde.
    var partagee = window.__variantsy && window.__variantsy.config;
    if (partagee) {
      return partagee.then(function (data) {
        return deepMerge(DEFAULT_CONFIG, data);
      });
    }

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeout = setTimeout(function () {
      if (controller) controller.abort();
    }, 4000);

    return fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: controller ? controller.signal : undefined,
    })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        clearTimeout(timeout);
        writeCache(data);
        return deepMerge(DEFAULT_CONFIG, data);
      })
      .catch(function (error) {
        clearTimeout(timeout);
        console.warn("[Variantsy] configuration indisponible, valeurs par défaut appliquées", error);
        return DEFAULT_CONFIG;
      });
  }

  /* ---------------------------------------------------------------------- */
  /* Détection des éléments du thème                                        */
  /* ---------------------------------------------------------------------- */

  var NATIVE_SELECTORS = [
    "variant-selects",
    "variant-radios",
    "variant-picker",
    ".product-form__input--dropdown",
    ".product-form__input--swatch",
    ".product-form__input--pill",
    ".product-variant-picker",
    ".selector-wrapper",
    ".single-option-selector",
    "[data-product-option]",
  ];

  var TITLE_SELECTORS = [
    "[data-variantsy-title]",
    ".product__title h1",
    ".product__title",
    "h1.product-single__title",
    "h1.product-title",
    ".product-meta__title",
    ".product__info-wrapper h1",
    ".product-info h1",
    "main h1",
  ];

  var GALLERY_SELECTORS = [
    "[data-variantsy-gallery]",
    "media-gallery",
    ".product__media-wrapper",
    ".product__media-list",
    ".product-gallery",
    ".product-single__media-group",
    ".product-media",
  ];

  var THUMB_SELECTORS = [
    "[data-variantsy-thumbs]",
    ".thumbnail-list",
    ".product__media-thumbnails",
    ".product-single__thumbnails",
    ".product-gallery__thumbnails",
    "[data-thumbnails]",
  ];

  /** Attributs susceptibles de porter un identifiant de média, par ordre de fiabilité. */
  var MEDIA_ID_ATTRS = ["data-media-id", "data-target", "data-thumbnail-id", "data-media", "id"];

  function findScope(root) {
    // On limite les recherches au conteneur produit le plus proche pour ne pas
    // toucher aux produits recommandés en bas de page.
    return (
      root.closest("[data-section-type='product']") ||
      root.closest(".product") ||
      root.closest("main") ||
      document
    );
  }

  function queryFirst(scope, selectors, extra) {
    var list = extra ? [extra].concat(selectors) : selectors;
    for (var i = 0; i < list.length; i++) {
      if (!list[i]) continue;
      try {
        var found = scope.querySelector(list[i]);
        if (found) return found;
      } catch (error) {
        /* sélecteur CSS invalide saisi par le marchand : on ignore */
      }
    }
    return null;
  }

  function queryAll(scope, selectors, extra) {
    var list = extra ? [extra].concat(selectors) : selectors;
    var out = [];
    list.forEach(function (selector) {
      if (!selector) return;
      try {
        Array.prototype.push.apply(out, scope.querySelectorAll(selector));
      } catch (error) {
        /* idem */
      }
    });
    return out;
  }

  /**
   * Extrait l'identifiant de média porté par un élément du thème.
   *
   * Les thèmes préfixent l'ID : `template--12345__main-987654321`. On lit donc
   * les chiffres de fin — mais en exigeant qu'ils soient précédés d'un
   * non-chiffre ET que l'ID obtenu existe réellement dans le produit. Sans cette
   * double vérification, un média 123 « matcherait » un élément portant 4123.
   */
  /**
   * Remonte au plus haut ancêtre qui n'enveloppe QUE cet élément.
   *
   * Nécessaire parce que les thèmes portent l'identifiant sur le bouton de la
   * miniature (`<li><button data-target="…">`). Masquer le bouton laisserait un
   * `<li>` vide qui garde sa marge et son espace dans la grille — la galerie
   * filtrée aurait des trous. On masque donc l'élément de liste entier.
   *
   * La condition `children.length === 1` garantit qu'on ne remonte jamais
   * jusqu'à un conteneur qui abrite d'autres médias.
   */
  /**
   * Remonte du nœud porteur de l'identifiant jusqu'à l'élément qu'il faut
   * réellement masquer.
   *
   * Le critère « parent à enfant unique » utilisé jusqu'ici cassait dès qu'une
   * vignette contenait autre chose que l'image : un badge, une légende, un
   * bouton de zoom. On s'arrêtait alors sur le conteneur interne, et la cellule
   * de grille qui l'entoure gardait sa hauteur — une case blanche vide à la
   * place de la photo. Constaté sur la grille desktop du thème Savor.
   *
   * Le bon critère est l'appartenance : on remonte tant que le parent n'abrite
   * pas un AUTRE média, puisque le masquer emporterait des photos qui doivent
   * rester visibles.
   */
  function hoist(element, container, known) {
    var node = element;
    while (node.parentElement && node.parentElement !== container) {
      if (countMediaIn(node.parentElement, known) > 1) break;
      node = node.parentElement;
    }
    return node;
  }

  /** Nombre de médias connus distincts présents sous un élément. */
  function countMediaIn(element, known) {
    if (!known) return 2; // prudence : sans référentiel, on ne remonte pas
    var selector = MEDIA_ID_ATTRS.map(function (attr) {
      return "[" + attr + "]";
    }).join(",");
    var found = element.querySelectorAll(selector);
    var ids = {};
    var total = 0;
    for (var i = 0; i < found.length; i++) {
      var id = mediaIdOf(found[i], known);
      if (id === null || ids[id]) continue;
      ids[id] = true;
      total += 1;
      if (total > 1) return total; // inutile de compter plus loin
    }
    return total;
  }

  function mediaIdOf(element, known) {
    for (var i = 0; i < MEDIA_ID_ATTRS.length; i++) {
      var raw = element.getAttribute(MEDIA_ID_ATTRS[i]);
      if (!raw) continue;
      var match = /(?:^|[^0-9])(\d+)$/.exec(raw.trim());
      if (match && known[match[1]]) return Number(match[1]);
    }
    return null;
  }

  /* ---------------------------------------------------------------------- */
  /* Instance                                                               */
  /* ---------------------------------------------------------------------- */

  function Variantsy(root, config) {
    this.root = root;
    this.config = config;
    this.scope = findScope(root);

    var dataEl = root.querySelector("[data-variantsy-data]");
    this.product = JSON.parse(dataEl.textContent);
    this.media = this.product.media || [];

    this.knownMedia = {};
    for (var i = 0; i < this.media.length; i++) this.knownMedia[String(this.media[i].id)] = true;

    /**
     * Couleurs natives des valeurs d'option, telles que le marchand les a
     * renseignées dans l'admin Shopify. Source la plus fiable dont on dispose :
     * elle vient de lui, pas d'une devinette, et elle arrive avec la page — ni
     * requête, ni latence, ni dépendance à l'API Admin.
     *
     * Clé : `${nom d'option normalisé}::${valeur normalisée}`, exactement comme
     * la bibliothèque du marchand, pour que les deux se consultent pareil.
     */
    this.nativeSwatches = {};
    var instance = this;
    (this.product.options || []).forEach(function (option) {
      var couleurs = option.sw;
      if (!couleurs) return;
      (option.values || []).forEach(function (value, index) {
        var couleur = couleurs[index];
        if (!couleur) return;
        instance.nativeSwatches[normalize(option.name) + "::" + normalize(value)] = couleur;
      });
    });

    this.optionNames = this.product.options.map(function (option) {
      return option.name;
    });

    var initialId = Number(root.getAttribute("data-current-variant"));
    var initial = this.findVariantById(initialId) || this.product.variants[0] || { o: [] };
    this.selection = initial.o.slice();

    this.form = this.findForm();
    this.originalTitle = null;
    this.originalDocumentTitle = null;
    this.preloaded = {};
    this.groups = null;
  }

  Variantsy.prototype.findVariantById = function (id) {
    for (var i = 0; i < this.product.variants.length; i++) {
      if (this.product.variants[i].id === id) return this.product.variants[i];
    }
    return null;
  };

  Variantsy.prototype.findVariantByOptions = function (options) {
    outer: for (var i = 0; i < this.product.variants.length; i++) {
      var variant = this.product.variants[i];
      for (var j = 0; j < options.length; j++) {
        if (variant.o[j] !== options[j]) continue outer;
      }
      return variant;
    }
    return null;
  };

  /** Formulaire d'ajout au panier : c'est lui qui décide de ce qui part au panier. */
  Variantsy.prototype.findForm = function () {
    return (
      this.scope.querySelector('form[action*="/cart/add"]') ||
      document.querySelector('form[action*="/cart/add"]')
    );
  };

  /* ====================================================================== */
  /* 1. GALERIE — groupage des médias par variante                          */
  /*                                                                        */
  /* Fonctions PURES : elles ne dépendent que de (product, config) et sont   */
  /* exposées sur `window.Variantsy`. C'est volontaire — l'admin en possède */
  /* un portage ESM (`app/grouping.js`) pour l'inspecteur de groupes, et le  */
  /* test de fumée compare les deux implémentations sur la même table de cas */
  /* (`scripts/grouping-cases.json`). Sans ce garde-fou, l'aperçu montré au  */
  /* marchand pourrait diverger de ce que voient ses clients.                */
  /* ====================================================================== */

  /**
   * Rattachement des médias à une valeur d'option d'après leur texte alternatif.
   * En cas de correspondance multiple, la valeur la plus longue gagne :
   * « bleu marine » doit l'emporter sur « bleu ».
   */
  function altOwners(product, index, cfg) {
    var option = (product.options || [])[index];
    if (!option) return {};

    var prefix = normalize(cfg.altPrefix || "");
    var owners = {};

    (product.media || []).forEach(function (media) {
      var alt = normalize(media.alt);
      if (!alt) return;
      var matched = null;
      option.values.forEach(function (value) {
        if (!containsToken(alt, prefix + normalize(value))) return;
        if (!matched || value.length > matched.length) matched = value;
      });
      if (matched) owners[media.id] = matched;
    });

    return owners;
  }

  /**
   * Détermine SUR QUELLE OPTION porte le groupage des images.
   *
   * En mode "auto", on cherche l'option dont les assignations d'images sont
   * cohérentes : toutes les variantes qui partagent la même valeur doivent
   * pointer vers le même média. Sur un produit Couleur × Taille où le marchand
   * a assigné une image par couleur, l'option Couleur passe le test et l'option
   * Taille échoue (S existe en noir ET en bleu, avec deux images différentes).
   *
   * À défaut d'assignation native, on retombe sur le texte alternatif.
   * Retourne -1 si aucune option ne convient : dans ce cas on ne filtre rien.
   */
  function resolveGroupIndex(product, cfg) {
    var options = product.options || [];
    var explicit = cfg.groupBy;
    if (/^option[123]$/.test(explicit)) {
      var forced = Number(explicit.slice(-1)) - 1;
      return forced < options.length ? forced : -1;
    }

    var variants = product.variants || [];
    var best = -1;
    var bestScore = 0;

    for (var i = 0; i < options.length; i++) {
      var seen = {};
      var conflict = false;
      var distinct = 0;

      for (var v = 0; v < variants.length; v++) {
        var variant = variants[v];
        if (!variant.m) continue;
        var value = variant.o[i];
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

    // Aucune image assignée nativement : on tente de déduire l'option porteuse
    // du seul indice restant, le texte alternatif des médias.
    for (var j = 0; j < options.length; j++) {
      var owners = altOwners(product, j, cfg);
      var values = {};
      var count = 0;
      Object.keys(owners).forEach(function (mediaId) {
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
   * Construit les groupes d'images.
   *
   * Règle principale (celle qui rend l'app « sans configuration ») : dans
   * l'ordre des médias du produit, une image assignée à une variante OUVRE son
   * groupe, et toutes les images suivantes le rejoignent jusqu'à la prochaine
   * image assignée. C'est la façon dont un marchand range déjà ses photos.
   *
   * Règle secondaire (repli) : si le texte alternatif d'un média contient une
   * valeur d'option, ce média est rattaché à cette valeur — utile quand l'ordre
   * des médias ne peut pas être modifié (import automatisé, PIM…).
   *
   * Les médias situés avant la première image assignée forment le groupe
   * « commun » : packshot générique, guide des tailles, vidéo de marque.
   *
   * Retourne null quand il ne faut RIEN filtrer.
   */
  function computeGroups(product, cfg) {
    var media = product.media || [];
    if (!cfg.enabled || !media.length) return null;

    var index = resolveGroupIndex(product, cfg);
    if (index < 0) return null;

    // 1. Assignations natives Shopify (une image par variante).
    var owners = {};
    (product.variants || []).forEach(function (variant) {
      if (variant.m && owners[variant.m] === undefined) owners[variant.m] = variant.o[index];
    });

    // 2. Repli sur le texte alternatif — UNIQUEMENT si le marchand n'a rattaché
    //    aucune image à aucune variante.
    //
    //    Protéger les seuls médias déjà assignés ne suffisait pas. Shopify
    //    recopie le titre du produit dans le texte alternatif de CHAQUE image :
    //    sur « IENA25 — Cocotte ronde en fonte beige », les quatorze photos
    //    contiennent le mot « beige », y compris les bleu marine. Le repli
    //    réattribuait donc à Beige tous les médias suivant l'assignation de
    //    Navy, vidant son groupe — treize visibles sur quatorze.
    //
    //    Dès qu'une image est rattachée, l'ORDRE fait foi et le texte
    //    alternatif se tait. Il ne sert plus qu'aux catalogues où rien n'est
    //    assigné, ce pour quoi il avait été écrit.
    var aDesAssignations = Object.keys(owners).length > 0;
    if (cfg.altFallback && !aDesAssignations) {
      var fromAlt = altOwners(product, index, cfg);
      Object.keys(fromAlt).forEach(function (mediaId) {
        if (owners[mediaId] === undefined) owners[mediaId] = fromAlt[mediaId];
      });
    }

    // 3. Parcours ordonné.
    var groups = {};
    var common = [];
    var order = [];
    var current = null;

    media.forEach(function (item) {
      order.push(item.id);
      if (owners[item.id] !== undefined) current = owners[item.id];
      if (current === null) {
        common.push(item.id);
        return;
      }
      if (!groups[current]) groups[current] = [];
      groups[current].push(item.id);
    });

    var keys = Object.keys(groups);
    if (!keys.length) return null;
    // Un seul groupe = rien à filtrer, et probablement un produit mal rangé.
    if (cfg.skipSingleGroup && keys.length < 2) return null;

    return { index: index, groups: groups, common: common, order: order, firstKey: keys[0] };
  }

  /**
   * Ensemble des médias visibles pour une valeur d'option donnée.
   * Retourne null quand il ne faut PAS filtrer (valeur sans groupe) : mieux
   * vaut afficher toute la galerie que de la vider.
   */
  function visibleMediaFor(groupsResult, value, cfg) {
    if (!groupsResult) return null;
    var list = groupsResult.groups[value];
    if (!list || !list.length) return null;

    var visible = {};
    list.forEach(function (id) {
      visible[id] = true;
    });

    var mode = cfg.commonMediaMode;
    if (mode === "append" || (mode === "first" && value === groupsResult.firstKey)) {
      groupsResult.common.forEach(function (id) {
        visible[id] = true;
      });
    }
    return visible;
  }

  /* ====================================================================== */
  /* 2. GALERIE — filtrage du DOM du thème                                  */
  /* ====================================================================== */

  /** Tous les nœuds du thème porteurs d'un identifiant de média connu. */
  Variantsy.prototype.collectMediaNodes = function () {
    var behavior = this.config.behavior;
    var gallery = queryFirst(this.scope, GALLERY_SELECTORS, behavior.imageSelectorCss);
    var thumbs = queryFirst(this.scope, THUMB_SELECTORS, this.config.gallery.thumbSelectorCss);
    var containers = [gallery, thumbs].filter(Boolean);
    if (!containers.length) containers = [this.scope];

    var known = this.knownMedia;
    var seen = [];
    var nodes = [];

    containers.forEach(function (container) {
      var selector = MEDIA_ID_ATTRS.map(function (attr) {
        return "[" + attr + "]";
      }).join(",");
      var candidates = container.querySelectorAll(selector);
      Array.prototype.forEach.call(candidates, function (element) {
        var id = mediaIdOf(element, known);
        if (id === null) return;
        var target = hoist(element, container, known);
        if (seen.indexOf(target) !== -1) return;
        // On ne retient que le nœud le plus haut de chaque sous-arbre : masquer
        // un <li> suffit, inutile de masquer aussi le <img> qu'il contient.
        for (var i = 0; i < nodes.length; i++) {
          if (nodes[i].element.contains(target)) return;
        }
        seen.push(target);
        nodes.push({ element: target, id: id });
      });
    });

    return { nodes: nodes, gallery: gallery, thumbs: thumbs };
  };

  /**
   * Applique le filtrage à la galerie du thème.
   * On masque en CSS (classe dédiée) plutôt que de retirer les nœuds : le zoom,
   * la lightbox, les vidéos et les modèles 3D du thème restent intacts.
   */
  /**
   * Cette option doit-elle s'afficher en pastilles plutôt qu'en boutons texte ?
   *
   * La détection reposait uniquement sur le nom de l'option, comparé à une
   * liste. Une boutique dont l'option s'appelle « Coloris » — courant en
   * français, et absent de la liste — obtenait des boutons texte à la place de
   * son nuancier, sans le moindre indice sur la cause.
   *
   * On regarde donc d'abord les VALEURS, qui ne mentent pas : si l'une d'elles
   * a une entrée dans la bibliothèque du marchand, ou se reconnaît dans le
   * dictionnaire de couleurs, l'option est une option de couleur quel que soit
   * son intitulé. « S / M / L » ne déclenchera jamais ce test.
   *
   * Le nom reste un signal secondaire : il rattrape le cas d'un nuancier
   * entièrement composé de teintes maison qu'aucun dictionnaire ne connaît.
   */
  Variantsy.prototype.looksLikeColorOption = function (group, optionName) {
    if (this.config.colorOptions.indexOf(optionName) !== -1) return true;

    var swatches = this.config.swatches || {};
    var dictionary = this.config.colors;
    var buttons = group.querySelectorAll(".variantsy__swatch");

    for (var i = 0; i < buttons.length; i++) {
      var value = normalize(buttons[i].getAttribute("data-variantsy-value"));
      if (!value) continue;
      if (swatches[optionName + "::" + value]) return true;
      // Une valeur à laquelle Shopify attache une couleur EST une couleur :
      // c'est le signal le plus fort qui soit, le marchand l'a saisi lui-même.
      if (estCouleurCss(this.nativeSwatches[optionName + "::" + value])) return true;
      // La valeur EST un code couleur (« #1F3A5F »).
      if (/^#[0-9a-f]{3,8}$/i.test(value)) return true;
      if (dictionary && guessColorFrom(dictionary, value)) return true;
    }
    return false;
  };

  /**
   * Construit une liste déroulante à partir des boutons déjà rendus.
   *
   * Le Liquid produit toujours des boutons — c'est ce qui garantit un contenu
   * lisible sans JavaScript, et le repli si notre script échoue. Le <select>
   * est donc fabriqué ici, à côté, et les boutons sont masqués en CSS. On ne
   * remplace jamais le balisage d'origine : une vente ne doit pas dépendre de
   * la réussite de ce code.
   */
  Variantsy.prototype.buildDropdown = function (group, position) {
    var self = this;
    var existing = group.querySelector(".variantsy__select");
    var buttons = group.querySelectorAll(".variantsy__swatch");
    var current = this.selection[position - 1];

    if (!existing) {
      existing = document.createElement("select");
      existing.className = "variantsy__select";
      existing.setAttribute("aria-label", group.getAttribute("data-option-name") || "");
      existing.addEventListener("change", function () {
        self.select(position, existing.value);
      });
      var host = group.querySelector(".variantsy__options") || group;
      host.parentNode.insertBefore(existing, host.nextSibling);
    }

    // On reconstruit les options à chaque passage : la disponibilité change
    // avec les autres sélections, et un choix devenu impossible doit le dire.
    existing.innerHTML = "";
    Array.prototype.forEach.call(buttons, function (button) {
      var value = button.getAttribute("data-variantsy-value");
      var option = document.createElement("option");
      option.value = value;
      var unavailable = button.getAttribute("data-unavailable") === "true";
      option.textContent = unavailable ? value + " — indisponible" : value;
      if (value === current) option.selected = true;
      existing.appendChild(option);
    });
  };

  Variantsy.prototype.applyGallery = function (variant) {
    if (!this.groups) return;

    var value = variant.o[this.groups.index];
    var visible = visibleMediaFor(this.groups, value, this.config.gallery);
    var collected = this.collectMediaNodes();
    if (!collected.nodes.length) return;

    collected.nodes.forEach(function (node) {
      var show = !visible || visible[node.id] === true;
      node.element.classList.toggle(HIDDEN_CLASS, !show);
      // aria-hidden en plus de display:none : certains thèmes forcent
      // l'affichage des slides, l'attribut garde les lecteurs d'écran cohérents.
      if (show) node.element.removeAttribute("aria-hidden");
      else node.element.setAttribute("aria-hidden", "true");
    });

    this.syncIndexedControls(collected, visible);
    this.promoteLeadCell(collected);
    this.refreshSliders(collected.gallery);
    this.focusFirstVisibleMedia(collected);
  };

  /**
   * Rend à la première photo visible le format que le thème réserve à sa
   * première cellule.
   *
   * Beaucoup de galeries en grille donnent à la cellule de tête un traitement
   * particulier — pleine largeur, deux colonnes — via une règle `:first-child`.
   * Or `display: none` ne change pas qui est le premier enfant : masquer les
   * cellules de tête laisse la première photo visible avec son format réduit,
   * et elle se retrouve à partager sa ligne avec la suivante. Constaté sur la
   * grille desktop de Savor, où la cellule de tête porte `grid-column: span 2`
   * et passait de 1010 px à 505 px au changement de coloris.
   *
   * On ne cherche pas à deviner la règle du thème : on recopie la valeur
   * calculée de la cellule de tête sur celle qui la remplace. Ce qui vaut pour
   * `span 2` vaudra pour n'importe quelle autre valeur.
   */
  Variantsy.prototype.promoteLeadCell = function (collected) {
    // Toujours annuler la promotion précédente d'abord : sans ça, une cellule
    // promue pour un coloris garderait son grand format pour le suivant.
    var previous = this.scope.querySelectorAll("[data-variantsy-promoted]");
    Array.prototype.forEach.call(previous, function (element) {
      element.style.gridColumn = "";
      element.style.gridRow = "";
      element.removeAttribute("data-variantsy-promoted");
    });

    if (!collected.gallery) return;

    // Conteneurs qui abritent réellement nos médias, dédupliqués.
    var containers = [];
    collected.nodes.forEach(function (node) {
      if (!collected.gallery.contains(node.element)) return;
      var parent = node.element.parentElement;
      if (parent && containers.indexOf(parent) === -1) containers.push(parent);
    });

    containers.forEach(function (container) {
      try {
        if (window.getComputedStyle(container).display.indexOf("grid") === -1) return;

        var kids = container.children;
        var lead = kids[0];
        if (!lead || !lead.classList.contains(HIDDEN_CLASS)) return;

        var leadStyle = window.getComputedStyle(lead);
        var column = leadStyle.gridColumn;
        var row = leadStyle.gridRow;
        // Rien de distinctif à transmettre : la cellule de tête est ordinaire.
        if ((column === "auto" || !column) && (row === "auto" || !row)) return;

        var target = null;
        for (var i = 0; i < kids.length; i++) {
          if (!kids[i].classList.contains(HIDDEN_CLASS)) {
            target = kids[i];
            break;
          }
        }
        if (!target || target === lead) return;
        if (window.getComputedStyle(target).gridColumn === column) return;

        if (column && column !== "auto") target.style.gridColumn = column;
        if (row && row !== "auto") target.style.gridRow = row;
        target.setAttribute("data-variantsy-promoted", "");
      } catch (error) {
        /* thème exotique : mieux vaut une grille imparfaite qu'une exception */
      }
    });
  };

  /**
   * Masque les commandes de navigation qui ne portent aucun identifiant.
   *
   * Les points de pagination d'un carrousel sont de simples puces ordonnées :
   * rien ne les relie explicitement à un média. Sans traitement, le thème
   * continue d'en annoncer quatorze quand sept photos seulement restent
   * accessibles — le visiteur clique et n'arrive nulle part.
   *
   * On les apparie donc par rang, mais seulement si leur nombre correspond
   * EXACTEMENT à celui des médias distincts de la galerie. Ce garde-fou évite
   * de mutiler une liste qui n'aurait rien à voir : en cas de doute, on
   * préfère des points en trop à des commandes détruites au hasard.
   */
  Variantsy.prototype.syncIndexedControls = function (collected, visible) {
    if (!collected.gallery || !visible) return;

    // Ordre d'apparition des médias distincts dans la galerie.
    var sequence = [];
    var seen = {};
    collected.nodes.forEach(function (node) {
      if (!collected.gallery.contains(node.element)) return;
      if (seen[node.id]) return;
      seen[node.id] = true;
      sequence.push(node.id);
    });
    if (sequence.length < 2) return;

    var lists = collected.gallery.querySelectorAll("ol, ul, [role='tablist']");
    Array.prototype.forEach.call(lists, function (list) {
      var children = list.children;
      if (children.length !== sequence.length) return;
      // Une liste qui porte déjà des identifiants est traitée par le filtrage
      // normal : y toucher ici la masquerait deux fois, sur deux critères.
      if (list.querySelector("[data-media-id],[data-target],[data-thumbnail-id]")) return;

      for (var i = 0; i < children.length; i++) {
        var show = visible[sequence[i]] === true;
        children[i].classList.toggle(HIDDEN_CLASS, !show);
        if (show) children[i].removeAttribute("aria-hidden");
        else children[i].setAttribute("aria-hidden", "true");
      }
    });
  };

  /**
   * Repositionne la galerie sur un média encore visible.
   *
   * Masquer des nœuds suffit sur une galerie en grille — l'hypothèse de départ
   * de l'app, calquée sur Dawn. Ça ne suffit pas sur un carrousel : celui-ci
   * garde son propre index de diapositive et continue d'afficher celle qu'on
   * vient de masquer, donc une zone vide à la place de la photo. Constaté sur
   * le thème Savor, dont la galerie est un <slideshow-component> resté sur
   * `initial-slide=0` alors que les sept premières diapositives étaient
   * masquées.
   *
   * Trois recours, du plus propre au plus universel : aucun n'est disponible
   * sur tous les thèmes, mais le dernier fonctionne sur n'importe quel
   * conteneur défilant, quel que soit son auteur.
   */
  Variantsy.prototype.focusFirstVisibleMedia = function (collected) {
    var gallery = collected.gallery;
    if (!gallery) return;

    var target = null;
    for (var i = 0; i < collected.nodes.length; i++) {
      var node = collected.nodes[i];
      if (node.element.classList.contains(HIDDEN_CLASS)) continue;
      if (!gallery.contains(node.element)) continue;
      target = node;
      break;
    }
    // Aucun média visible : le garde-fou amont a déjà annulé tout filtrage.
    // Toucher au défilement ici ne ferait qu'ajouter du désordre.
    if (!target) return;

    // Chaque recours est VÉRIFIÉ, pas cru sur parole. Un thème peut exposer
    // une méthode qui ne lève aucune exception sans rien repositionner pour
    // autant : c'est le cas de Savor, dont le composant acceptait l'appel et
    // laissait le carrousel exactement où il était. « Ne pas planter » n'est
    // pas « avoir fonctionné ».
    if (this.mediaIsInView(gallery, target.element)) return;

    this.focusViaThumbnail(collected, target.id);
    if (this.mediaIsInView(gallery, target.element)) return;

    this.focusViaComponentApi(gallery, target);
    if (this.mediaIsInView(gallery, target.element)) return;

    // Dernier recours, synchrone et sans intermédiaire : il fait autorité.
    this.focusViaScroll(gallery, target.element);
  };

  /**
   * Le média est-il réellement à sa place dans la fenêtre de la galerie ?
   *
   * On compare les bords à l'écran plutôt que de faire confiance à un appel de
   * méthode : c'est la seule mesure qui corresponde à ce que voit le visiteur.
   */
  Variantsy.prototype.mediaIsInView = function (gallery, element) {
    try {
      var box = element.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return false;
      var scroller = findScroller(element, gallery);
      if (!scroller) return true; // pas de défilement : rien à recaler
      var frame = scroller.getBoundingClientRect();
      return Math.abs(box.left - frame.left) <= 1;
    } catch (error) {
      return true; // en cas de doute, ne pas s'acharner
    }
  };

  /** Premier ancêtre défilant horizontalement, sans dépasser la galerie. */
  function findScroller(element, gallery) {
    var node = element.parentNode;
    while (node && node !== gallery.parentNode && node.nodeType === 1) {
      var overflow = window.getComputedStyle(node).overflowX;
      if (overflow === "auto" || overflow === "scroll") return node;
      node = node.parentNode;
    }
    return null;
  }

  /**
   * Recours 1 — cliquer la miniature correspondante.
   * C'est le chemin que le visiteur emprunterait lui-même, donc celui qui
   * laisse l'état interne du thème cohérent : compteur de diapositives,
   * attributs ARIA, zoom et lightbox restent synchronisés.
   */
  Variantsy.prototype.focusViaThumbnail = function (collected, mediaId) {
    if (!collected.thumbs) return false;
    for (var i = 0; i < collected.nodes.length; i++) {
      var node = collected.nodes[i];
      if (node.id !== mediaId) continue;
      if (!collected.thumbs.contains(node.element)) continue;
      if (node.element.classList.contains(HIDDEN_CLASS)) continue;
      var clickable =
        node.element.querySelector("button, a, [role='button']") ||
        (node.element.tagName === "BUTTON" || node.element.tagName === "A"
          ? node.element
          : null);
      if (!clickable) return false;
      try {
        clickable.click();
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  };

  /**
   * Recours 2 — l'API du composant de galerie, quand le thème en expose une.
   * On tente plusieurs noms de méthode parce qu'il n'existe aucune convention :
   * chaque thème nomme la sienne comme il l'entend.
   */
  Variantsy.prototype.focusViaComponentApi = function (gallery, target) {
    var hosts = [gallery];
    var nested = gallery.querySelectorAll(
      "media-gallery, slideshow-component, slider-component",
    );
    Array.prototype.push.apply(hosts, Array.prototype.slice.call(nested));

    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      if (!host) continue;
      var methods = ["setActiveMedia", "select", "slideTo", "goToSlide", "setActiveSlide"];
      for (var m = 0; m < methods.length; m++) {
        if (typeof host[methods[m]] !== "function") continue;
        try {
          // Les signatures diffèrent : certaines attendent l'identifiant du
          // média, d'autres l'élément, d'autres un index. On passe les trois.
          host[methods[m]](target.id, target.element, 0);
          return true;
        } catch (error) {
          /* méthode incompatible : on essaie la suivante */
        }
      }
    }
    return false;
  };

  /**
   * Recours 3 — faire défiler le conteneur jusqu'au média.
   * Sans élégance mais sans dépendance : fonctionne sur tout carrousel à
   * défilement natif, y compris ceux qu'on n'a jamais vus.
   */
  Variantsy.prototype.focusViaScroll = function (gallery, element) {
    try {
      var scroller = findScroller(element, gallery);
      if (scroller) {
        {
          // Différence de positions à l'écran, et non `offsetLeft` : ce dernier
          // se mesure depuis l'ancêtre positionné, qui n'est pas forcément le
          // conteneur défilant. Quand les deux diffèrent, le carrousel se cale
          // entre deux diapositives et laisse une bande vide sur le côté.
          var delta =
            element.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
          if (Math.abs(delta) < 1) return;
          scroller.scrollLeft += delta;
          return;
        }
      }
      // Aucun conteneur défilant identifié : on laisse le navigateur décider,
      // en restant sur « nearest » pour ne pas emporter la page entière.
      if (typeof element.scrollIntoView === "function") {
        element.scrollIntoView({ block: "nearest", inline: "start" });
      }
    } catch (error) {
      /* noop : mieux vaut une galerie mal cadrée qu'une exception */
    }
  };

  /** Rend leur visibilité à tous les médias (galerie désactivée, cas dégradé). */
  Variantsy.prototype.restoreGallery = function () {
    var hidden = this.scope.querySelectorAll("." + HIDDEN_CLASS);
    Array.prototype.forEach.call(hidden, function (element) {
      element.classList.remove(HIDDEN_CLASS);
      element.removeAttribute("aria-hidden");
    });
    // La cellule promue doit aussi rendre son format : la cellule de tête
    // d'origine étant de nouveau visible, deux cellules pleine largeur
    // cohabiteraient sinon.
    var promoted = this.scope.querySelectorAll("[data-variantsy-promoted]");
    Array.prototype.forEach.call(promoted, function (element) {
      element.style.gridColumn = "";
      element.style.gridRow = "";
      element.removeAttribute("data-variantsy-promoted");
    });
  };

  /**
   * Prévient le thème que la géométrie de la galerie a changé.
   * Les carrousels calculent leurs largeurs au chargement ; sans ce coup de
   * pouce, on obtient des pages vides et un compteur « 3 / 7 » faux.
   */
  Variantsy.prototype.refreshSliders = function (gallery) {
    var container = gallery || this.scope;
    // `slider-component` est l'élément de Dawn. Les thèmes récents de Shopify
    // (Savor et la famille Horizon) nomment le leur `slideshow-component`, et
    // ne recalculaient donc jamais leur géométrie après un filtrage.
    var sliders = container.querySelectorAll
      ? container.querySelectorAll("slider-component, slideshow-component, media-gallery")
      : [];
    Array.prototype.forEach.call(sliders, function (slider) {
      try {
        if (typeof slider.initPages === "function") slider.initPages();
        if (typeof slider.resetPages === "function") slider.resetPages();
        if (typeof slider.update === "function") slider.update();
      } catch (error) {
        /* thème récalcitrant : le resize ci-dessous suffit généralement */
      }
    });
    try {
      window.dispatchEvent(new Event("resize"));
    } catch (error) {
      /* noop */
    }
  };

  /* ====================================================================== */
  /* 3. Disponibilité et rendu des swatches                                 */
  /* ====================================================================== */

  /**
   * Une valeur est « disponible » s'il existe au moins une variante en stock
   * qui la contient, en respectant les choix déjà faits sur les options
   * précédentes. C'est la logique attendue par les clients : choisir « Bleu »
   * puis voir quelles tailles restent, et non l'inverse.
   */
  Variantsy.prototype.isValueAvailable = function (position, value) {
    var index = position - 1;
    for (var i = 0; i < this.product.variants.length; i++) {
      var variant = this.product.variants[i];
      if (variant.o[index] !== value) continue;
      if (!variant.a) continue;
      var matches = true;
      for (var j = 0; j < this.selection.length; j++) {
        if (j === index) continue;
        if (j < index && variant.o[j] !== this.selection[j]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
    return false;
  };

  Variantsy.prototype.paint = function () {
    var self = this;
    var style = this.config.style;
    var behavior = this.config.behavior;

    this.root.setAttribute("data-selected-style", style.selectedStyle);
    this.root.setAttribute("data-sold-out", behavior.soldOutStyle);
    this.root.style.setProperty("--vtsy-size", style.size + "px");
    this.root.style.setProperty("--vtsy-gap", style.gap + "px");
    this.root.style.setProperty("--vtsy-border-width", style.borderWidth + "px");
    this.root.style.setProperty("--vtsy-border-color", style.borderColor);
    this.root.style.setProperty("--vtsy-selected-color", style.selectedColor);
    this.root.style.setProperty(
      "--vtsy-selected-width",
      num(style.selectedWidth, 2) + "px",
    );
    this.root.style.setProperty("--vtsy-selected-gap", num(style.selectedGap, 2) + "px");
    this.root.style.setProperty("--vtsy-control-radius", num(style.controlRadius, 6) + "px");
    // Taille des seules pastilles qui portent une photo : un aplat de couleur
    // reste lisible à 40 px, une photo de produit non.
    this.root.style.setProperty(
      "--vtsy-photo-size",
      Math.round((num(style.size, 40) * num(style.photoScale, 100)) / 100) + "px",
    );
    this.root.setAttribute("data-control-selected", style.controlSelectedStyle || "outline");
    // Ces deux affichages étaient pilotés par le bloc Liquid, donc figés au
    // rendu et invisibles depuis l'app. Ils sont désormais rendus toujours et
    // masqués ici : changer le réglage produit un effet immédiat.
    this.root.setAttribute("data-show-labels", style.showLabels ? "true" : "false");
    this.root.setAttribute("data-show-option-name", style.showOptionName ? "true" : "false");
    // Le texte doit rester lisible sur le fond plein, quelle que soit la teinte
    // choisie par le marchand : on la mesure au lieu de parier sur du blanc.
    this.root.style.setProperty(
      "--vtsy-selected-contrast",
      contrasteSur(style.selectedColor) ,
    );
    // « auto » laisse la liste se dimensionner sur son contenu ; « 100% »
    // l'étend à la largeur disponible.
    this.root.style.setProperty(
      "--vtsy-control-width",
      style.dropdownFullWidth ? "100%" : "auto",
    );
    this.root.style.setProperty(
      "--vtsy-radius",
      style.shape === "square"
        ? "0px"
        : style.shape === "rounded"
          ? num(style.cornerRadius, 8) + "px"
          : "50%",
    );

    // La rangée « produits liés » porte les mêmes classes pour hériter du même
    // habillage, mais ce ne sont PAS des variantes : ses pastilles sont des
    // liens vers d'autres fiches. Les passer à la moulinette des variantes les
    // repeignait depuis le dictionnaire, effaçait la sélection posée par le
    // Liquid et les marquait indisponibles — aucune variante ne leur répondant.
    var groups = this.root.querySelectorAll(
      ".variantsy__group:not([data-variantsy-linked])",
    );
    Array.prototype.forEach.call(groups, function (group) {
      var position = Number(group.getAttribute("data-option-position"));
      var optionName = normalize(group.getAttribute("data-option-name"));
      // Le mode d'affichage ne s'applique qu'aux options de COULEUR : une
      // taille n'a jamais été une pastille, la forcer en liste déroulante
      // parce que le marchand a choisi ce mode pour ses coloris n'aurait
      // aucun sens.
      var mode = style.displayMode || "swatch";
      var isColor = self.looksLikeColorOption(group, optionName);
      var asSwatch = isColor && mode === "swatch";

      group.classList.toggle("variantsy__group--color", asSwatch);
      group.classList.toggle("variantsy__group--text", !asSwatch);
      group.classList.toggle("variantsy__group--dropdown", isColor && mode === "dropdown");
      if (isColor && mode === "dropdown") self.buildDropdown(group, position);

      var labelValue = group.querySelector("[data-variantsy-current-value]");
      if (labelValue) labelValue.textContent = self.selection[position - 1] || "";

      var swatches = group.querySelectorAll(".variantsy__swatch");
      Array.prototype.forEach.call(swatches, function (button) {
        var value = button.getAttribute("data-variantsy-value");
        var selected = self.selection[position - 1] === value;
        var available = self.isValueAvailable(position, value);

        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-checked", String(selected));
        button.setAttribute("tabindex", selected ? "0" : "-1");
        button.setAttribute("data-unavailable", String(!available));

        if (isColor) {
          var visual = button.querySelector(".variantsy__visual");
          if (visual) self.applyVisual(visual, optionName, value);
        }
      });

      if (!isColor) self.syncFontSizes(group);
    });

    // --- Rangées de produits liés -----------------------------------------
    // Elles sont exclues de la boucle ci-dessus, et c'est nécessaire : leurs
    // pastilles sont des LIENS vers d'autres fiches, aucune variante ne leur
    // répond, et les soumettre à la logique de disponibilité les marquait
    // épuisées en effaçant la sélection posée par le thème.
    //
    // Mais les exclure ENTIÈREMENT les privait aussi de l'habillage : elles
    // gardaient la photo posée par le Liquid et ignoraient la bibliothèque de
    // couleurs, le mode d'affichage et le repli choisis par le marchand. Deux
    // rangées côte à côte n'avaient pas la même apparence.
    //
    // On leur applique donc le VISUEL, et rien d'autre.
    var liees = this.root.querySelectorAll(".variantsy__group[data-variantsy-linked]");
    Array.prototype.forEach.call(liees, function (group) {
      var optionName = normalize(group.getAttribute("data-option-name"));
      var mode = style.displayMode || "swatch";
      var asSwatch = mode === "swatch";

      group.classList.toggle("variantsy__group--color", asSwatch);
      group.classList.toggle("variantsy__group--text", !asSwatch);

      Array.prototype.forEach.call(
        group.querySelectorAll(".variantsy__swatch"),
        function (lien) {
          if (!asSwatch) return;
          var visual = lien.querySelector(".variantsy__visual");
          if (!visual) return;
          // La photo de la fiche sœur, posée par le Liquid, sert de repli : on
          // ne l'écrase que si la bibliothèque ou le dictionnaire sait faire
          // mieux — une couleur franche vaut mieux qu'une vignette.
          var avant = visual.style.backgroundImage;
          self.applyVisual(visual, optionName, lien.getAttribute("data-variantsy-value"));
          if (!visual.style.backgroundColor && !visual.style.backgroundImage && avant) {
            visual.style.backgroundImage = avant;
          }
        },
      );
    });

    if (style.customCss) this.injectCustomCss(style.customCss);
  };

  /** Applique la couleur / l'image d'un swatch depuis la bibliothèque marchand. */
  Variantsy.prototype.applyVisual = function (visual, optionName, value) {
    var key = optionName + "::" + normalize(value);
    var swatch = this.config.swatches[key];

    // Couleur native Shopify : renseignée par le marchand lui-même dans son
    // admin, donc plus fiable que n'importe quelle devinette. Elle ne passe
    // toutefois PAS devant la bibliothèque de l'app : celle-ci est une
    // correction explicite, et corriger doit rester possible.
    var native = estCouleurCss(this.nativeSwatches[optionName + "::" + normalize(value)]);

    if (!swatch && native) {
      visual.classList.remove("is-photo");
      visual.style.backgroundImage = "none";
      visual.style.backgroundColor = native;
      return;
    }

    if (!swatch) {
      var style = this.config.style || {};
      var neutral = style.neutralColor || "#ECECEC";
      var mode = style.swatchFallback || "image";

      // Repli 1 : la valeur EST un code couleur (« #1F3A5F »).
      if (/^#[0-9a-f]{3,8}$/i.test(value.trim())) {
        visual.style.background = value.trim();
        return;
      }

      // Repli 2 : deviner la couleur d'après le nom, en mode « pastilles de
      // couleur ». Le dictionnaire arrive dans la config, il n'alourdit donc
      // pas ce fichier — et le marchand n'a rien eu à saisir.
      if (mode === "color") {
        var guessed = guessColorFrom(this.config.colors, value);
        visual.classList.remove("is-photo");
        visual.style.backgroundImage = "none";
        visual.style.backgroundColor = guessed || neutral;
        return;
      }

      // Repli 3 : la photo de la variante. Utile quand les coloris ne portent
      // pas de nom de couleur (motifs, imprimés), trompeur quand tous les
      // produits se ressemblent — d'où le réglage ci-dessus.
      if (mode === "image") {
        var fallback = this.mediaForValue(optionName, value);
        if (fallback) {
          visual.style.backgroundImage = 'url("' + fallback + '")';
          visual.style.backgroundColor = "transparent";
          visual.classList.add("is-photo");
          return;
        }
      }

      visual.style.backgroundImage = "none";
      visual.style.backgroundColor = neutral;
      return;
    }

    if (swatch.kind === "image" && swatch.img) {
      visual.style.backgroundImage = 'url("' + swatch.img + '")';
      visual.style.backgroundColor = "transparent";
      visual.classList.add("is-photo");
    } else if (swatch.kind === "gradient" && swatch.c1 && swatch.c2) {
      visual.classList.remove("is-photo");
      visual.style.backgroundImage =
        "linear-gradient(135deg, " + swatch.c1 + " 0 50%, " + swatch.c2 + " 50% 100%)";
    } else if (swatch.c1) {
      visual.classList.remove("is-photo");
      visual.style.backgroundImage = "none";
      visual.style.backgroundColor = swatch.c1;
    }
  };

  /** Première image d'une variante portant cette valeur d'option. */
  Variantsy.prototype.mediaForValue = function (optionName, value) {
    var index = -1;
    for (var i = 0; i < this.optionNames.length; i++) {
      if (normalize(this.optionNames[i]) === optionName) {
        index = i;
        break;
      }
    }
    if (index < 0) return null;
    for (var v = 0; v < this.product.variants.length; v++) {
      var variant = this.product.variants[v];
      if (variant.o[index] === value && variant.img) return variant.img;
    }
    return null;
  };

  /**
   * PIÈGE N°5, deuxième partie (voir CLAUDE.md).
   *
   * Sur une ligne flex de boutons texte auto-ajustés, réduire la police du
   * premier bouton libère de l'espace pour les suivants : mesurés juste après,
   * ils n'ont plus besoin de rétrécir, et on se retrouve avec des tailles de
   * police différentes sur une même ligne.
   *
   * D'où les DEUX passes :
   *   1. mesure individuelle → taille minimale nécessaire par bouton
   *   2. synchronisation → on applique le minimum de la ligne à TOUS les boutons
   */
  Variantsy.prototype.syncFontSizes = function (group) {
    var container = group.querySelector(".variantsy__options");
    if (!container) return;
    var buttons = container.querySelectorAll(".variantsy__swatch");
    if (!buttons.length) return;

    var BASE = 15; // px
    var MIN = 11;
    var minNeeded = BASE;

    Array.prototype.forEach.call(buttons, function (button) {
      var text = button.querySelector(".variantsy__text");
      if (!text) return;
      button.style.removeProperty("--vtsy-text-size");
      var available = button.clientWidth - 28;
      if (available <= 0) return;
      var needed = text.scrollWidth;
      if (needed > available) {
        var scaled = Math.max(MIN, Math.floor((BASE * available) / needed));
        if (scaled < minNeeded) minNeeded = scaled;
      }
    });

    if (minNeeded < BASE) {
      Array.prototype.forEach.call(buttons, function (button) {
        button.style.setProperty("--vtsy-text-size", minNeeded + "px");
      });
    }
  };

  Variantsy.prototype.injectCustomCss = function (css) {
    var id = "variantsy-custom-css";
    var existing = document.getElementById(id);
    if (existing) {
      existing.textContent = css;
      return;
    }
    var style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  };

  /* ====================================================================== */
  /* 4. Sélection                                                           */
  /* ====================================================================== */

  Variantsy.prototype.select = function (position, value) {
    var index = position - 1;
    if (this.selection[index] === value) return;

    this.selection[index] = value;

    // La combinaison choisie peut ne pas exister (« Rouge » n'existe pas en
    // « XL »). On rabat alors les options suivantes sur la première combinaison
    // valide, plutôt que de laisser le client sur une variante inexistante.
    var variant = this.findVariantByOptions(this.selection);
    if (!variant) {
      variant = this.findBestMatch(index, value);
      if (variant) this.selection = variant.o.slice();
    }
    if (!variant) return;

    this.paint();
    this.applyVariant(variant);
  };

  Variantsy.prototype.findBestMatch = function (index, value) {
    var self = this;
    var candidates = this.product.variants.filter(function (variant) {
      return variant.o[index] === value;
    });
    if (!candidates.length) return null;

    function score(variant) {
      var count = 0;
      for (var i = 0; i < variant.o.length; i++) {
        if (i !== index && variant.o[i] === self.selection[i]) count += 1;
      }
      return count;
    }

    candidates.sort(function (a, b) {
      if (a.a !== b.a) return a.a ? -1 : 1;
      return score(b) - score(a);
    });
    return candidates[0];
  };

  /* ====================================================================== */
  /* 5. Propagation vers le thème                                           */
  /* ====================================================================== */

  Variantsy.prototype.applyVariant = function (variant) {
    this.root.setAttribute("data-current-variant", String(variant.id));

    var steps = [
      ["formulaire", this.updateForm],
      ["sélecteur natif", this.updateNativeSelector],
      ["url", this.config.behavior.updateUrl ? this.updateUrl : null],
      ["galerie", this.groups ? this.applyGallery : null],
      ["image", !this.groups && this.config.behavior.swapImage ? this.updateImage : null],
      ["titre", this.config.behavior.updateTitle ? this.updateTitle : null],
    ];

    for (var i = 0; i < steps.length; i++) {
      var fn = steps[i][1];
      if (!fn) continue;
      try {
        fn.call(this, variant);
      } catch (error) {
        // Une étape qui échoue ne doit jamais empêcher les suivantes : le
        // formulaire compte plus que le titre, le titre plus que la galerie.
        console.warn("[Variantsy] étape « " + steps[i][0] + " » en échec", error);
      }
    }

    document.dispatchEvent(
      new CustomEvent("variantsy:variant:change", {
        detail: { variant: variant, productId: this.product.id },
      }),
    );
  };

  /**
   * Écrit l'ID de variante dans le formulaire d'ajout au panier.
   * Filet de sécurité ultime : même si le thème ignore tous nos événements, le
   * panier reçoit la bonne variante.
   */
  Variantsy.prototype.updateForm = function (variant) {
    if (!this.form) return;
    var input =
      this.form.querySelector('input[name="id"]') || this.form.querySelector('select[name="id"]');
    if (input) {
      input.value = String(variant.id);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    var button = this.form.querySelector('[type="submit"], [name="add"]');
    if (button) {
      button.disabled = !variant.a;
      var label = button.querySelector("span") || button;
      if (!variant.a) {
        if (!button.getAttribute("data-variantsy-label")) {
          button.setAttribute("data-variantsy-label", label.textContent.trim());
        }
        label.textContent = "Rupture de stock";
      } else if (button.getAttribute("data-variantsy-label")) {
        label.textContent = button.getAttribute("data-variantsy-label");
      }
    }
  };

  /**
   * Pilote le sélecteur natif du thème (select ou radios) et déclenche ses
   * événements. Beaucoup de thèmes accrochent leur logique de prix, de stock ou
   * de galerie à ces événements : on les laisse faire leur travail.
   */
  Variantsy.prototype.updateNativeSelector = function (variant) {
    var scope = this.scope;

    function matchesOption(element, name, index) {
      var attrs = [
        element.getAttribute("name"),
        element.getAttribute("data-option-name"),
        element.getAttribute("data-index"),
        element.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        attrs.indexOf(normalize(name)) !== -1 ||
        attrs.indexOf("option" + (index + 1)) !== -1 ||
        attrs.indexOf("option-" + index) !== -1
      );
    }

    this.optionNames.forEach(function (name, index) {
      var value = variant.o[index];
      if (value === undefined) return;

      var selects = scope.querySelectorAll('select[name*="option"], select[data-index], .single-option-selector');
      Array.prototype.forEach.call(selects, function (select) {
        if (!matchesOption(select, name, index)) return;
        if (select.value === value) return;
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });

      var radios = scope.querySelectorAll('input[type="radio"]');
      Array.prototype.forEach.call(radios, function (radio) {
        if (radio.value !== value) return;
        if (!matchesOption(radio, name, index)) return;
        if (radio.checked) return;
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  };

  Variantsy.prototype.updateUrl = function (variant) {
    var url = new URL(window.location.href);
    url.searchParams.set("variant", String(variant.id));
    window.history.replaceState({ variantsy: variant.id }, "", url.toString());
  };

  /**
   * Bascule sur l'image principale de la variante.
   * Utilisé seul quand le groupage n'a pas pu s'appliquer ; appelé aussi après
   * le filtrage pour amener le carrousel sur la première image du groupe.
   */
  Variantsy.prototype.updateImage = function (variant) {
    if (!variant.m) return;
    var behavior = this.config.behavior;
    var gallery = queryFirst(this.scope, GALLERY_SELECTORS, behavior.imageSelectorCss) || this.scope;

    // 1. Le média existe dans la galerie : on le « clique » comme l'aurait fait
    //    le client, donc slider, miniatures et zoom restent cohérents.
    var known = this.knownMedia;
    var candidates = gallery.querySelectorAll("[data-media-id],[data-target],[data-thumbnail-id]");
    for (var i = 0; i < candidates.length; i++) {
      if (mediaIdOf(candidates[i], known) !== variant.m) continue;
      if (candidates[i].classList.contains(HIDDEN_CLASS)) continue;
      var trigger =
        candidates[i].tagName === "BUTTON" || candidates[i].tagName === "A"
          ? candidates[i]
          : candidates[i].querySelector("button, a");
      if (trigger) {
        trigger.click();
        return;
      }
      if (typeof candidates[i].scrollIntoView === "function") {
        candidates[i].scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
        return;
      }
    }

    // 2. API media de Dawn.
    var mediaGallery = gallery.closest("media-gallery") || gallery.querySelector("media-gallery");
    if (mediaGallery && typeof mediaGallery.setActiveMedia === "function") {
      mediaGallery.setActiveMedia(mediaGallery.dataset.section + "-" + variant.m, true);
      return;
    }

    // 3. Dernier recours : remplacer la source de l'image principale.
    if (!variant.img) return;
    var img = gallery.querySelector("img");
    if (img) {
      img.setAttribute("src", variant.img);
      img.setAttribute("srcset", "");
      if (variant.imgAlt) img.setAttribute("alt", variant.imgAlt);
    }
  };

  /** Variables disponibles dans le template de titre pour une variante donnée. */
  Variantsy.prototype.templateVars = function (variant) {
    var vars = {
      product_title: this.originalTitle,
      // « Default Title » est le titre que Shopify donne à la variante unique
      // d'un produit sans option. Ce n'est pas un nom : c'est l'absence de nom.
      // Le recopier produisait « Cocotte bleu marine Default Title » sur toute
      // fiche liée — celles-là mêmes qui n'ont qu'une variante.
      variant_title: (function () {
        if (variant.t && variant.t !== "Default Title") return variant.t;
        // Le repli par les options reproduisait le problème : leur seule valeur
        // est « Default Title » elle aussi.
        var utiles = (variant.o || []).filter(function (v) {
          return v && v !== "Default Title";
        });
        return utiles.join(" / ");
      })(),
      option1: variant.o[0] || "",
      option2: variant.o[1] || "",
      option3: variant.o[2] || "",
      price: variant.p || "",
      compare_at_price: variant.cp || "",
      sku: variant.sku || "",
      barcode: variant.bc || "",
      vendor: this.product.vendor || "",
      product_type: this.product.type || "",
    };
    // Accès par nom d'option : {{option:Couleur}}
    this.optionNames.forEach(function (name, index) {
      vars["option:" + normalize(name)] = variant.o[index] || "";
    });
    return vars;
  };

  /**
   * Réécrit le titre du produit à partir du template marchand.
   * `originalTitle` est mémorisé au premier passage : sans cela, le template
   * repartirait du titre déjà réécrit et concatènerait à l'infini.
   */
  Variantsy.prototype.updateTitle = function (variant) {
    var behavior = this.config.behavior;
    var element = queryFirst(this.scope, TITLE_SELECTORS, behavior.titleSelectorCss);

    if (this.originalTitle === null) {
      this.originalTitle =
        this.product.title || (element ? element.textContent.trim() : "");
    }
    if (this.originalDocumentTitle === null) this.originalDocumentTitle = document.title;

    var rendered = renderTemplate(behavior.titleTemplate, this.templateVars(variant));
    if (!rendered) return;

    if (element && element.textContent.trim() !== rendered) element.textContent = rendered;

    if (behavior.updateDocumentTitle) {
      // On remplace le nom du produit dans le titre de l'onglet en gardant le
      // suffixe du thème (« – Ma Boutique »).
      var suffix = this.originalDocumentTitle.replace(this.originalTitle, "").trim();
      document.title = suffix ? rendered + " " + suffix : rendered;
    }
  };

  /* ====================================================================== */
  /* 6. Interactions                                                        */
  /* ====================================================================== */

  Variantsy.prototype.bind = function () {
    var self = this;

    this.root.addEventListener("click", function (event) {
      var button = event.target.closest(".variantsy__swatch");
      // Un lien de produit lié navigue : on ne l'intercepte pas.
      if (button && button.closest("[data-variantsy-linked]")) return;
      if (!button || !self.root.contains(button)) return;
      event.preventDefault();
      self.select(
        Number(button.getAttribute("data-option-position")),
        button.getAttribute("data-variantsy-value"),
      );
    });

    this.root.addEventListener("keydown", function (event) {
      if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].indexOf(event.key) === -1) return;
      var button = event.target.closest(".variantsy__swatch");
      // Un lien de produit lié navigue : on ne l'intercepte pas.
      if (button && button.closest("[data-variantsy-linked]")) return;
      if (!button) return;
      var group = button.closest(".variantsy__group");
      var buttons = Array.prototype.slice
        .call(group.querySelectorAll(".variantsy__swatch"))
        .filter(function (candidate) {
          return candidate.offsetParent !== null;
        });
      var index = buttons.indexOf(button);
      var forward = event.key === "ArrowRight" || event.key === "ArrowDown";
      var next = buttons[(index + (forward ? 1 : -1) + buttons.length) % buttons.length];
      if (!next) return;
      event.preventDefault();
      next.focus();
      self.select(
        Number(next.getAttribute("data-option-position")),
        next.getAttribute("data-variantsy-value"),
      );
    });

    if (this.config.behavior.preloadOnHover) {
      this.root.addEventListener(
        "pointerenter",
        function (event) {
          var button = event.target.closest && event.target.closest(".variantsy__swatch");
          if (button && button.closest("[data-variantsy-linked]")) return;
          if (!button) return;
          self.preload(
            Number(button.getAttribute("data-option-position")),
            button.getAttribute("data-variantsy-value"),
          );
        },
        true,
      );
    }
  };

  Variantsy.prototype.preload = function (position, value) {
    var index = position - 1;
    var candidate = this.product.variants.find(function (variant) {
      return variant.o[index] === value && variant.img;
    });
    if (!candidate || this.preloaded[candidate.img]) return;
    this.preloaded[candidate.img] = true;
    var img = new Image();
    img.src = candidate.img;
  };

  /**
   * Masque le sélecteur natif — seulement maintenant, une fois Variantsy peint
   * et opérationnel. Si le script avait échoué avant, le client garde un
   * sélecteur fonctionnel.
   */
  Variantsy.prototype.hideNative = function () {
    if (!this.config.behavior.hideNativeSelector) return;
    var elements = queryAll(this.scope, NATIVE_SELECTORS, this.config.behavior.nativeSelectorCss);
    var root = this.root;
    elements.forEach(function (element) {
      if (element.contains(root) || root.contains(element)) return;
      element.classList.add("variantsy-native-hidden");
    });
  };

  Variantsy.prototype.start = function () {
    this.groups = null;
    try {
      this.groups = computeGroups(this.product, this.config.gallery);
    } catch (error) {
      console.warn("[Variantsy] groupage des images impossible", error);
    }
    this.root.setAttribute("data-gallery-mode", this.groups ? "grouped" : "off");

    this.paint();
    this.bind();
    this.hideNative();

    var variant = this.findVariantByOptions(this.selection);
    if (!variant) return;

    // Au chargement, le thème a déjà rendu la bonne variante côté serveur : on
    // ne touche ni à l'URL ni au formulaire. En revanche le filtrage de la
    // galerie et le titre dépendent de notre config, donc ils s'appliquent.
    if (this.groups) {
      try {
        this.applyGallery(variant);
      } catch (error) {
        console.warn("[Variantsy] filtrage initial impossible", error);
        this.restoreGallery();
      }
    }
    if (this.config.behavior.updateTitle) {
      try {
        this.updateTitle(variant);
      } catch (error) {
        /* noop */
      }
    }

    if (this.groups) this.watchGallery(variant);
  };

  /**
   * Réapplique le filtrage quand le thème complète sa galerie APRÈS nous.
   *
   * Savor — et beaucoup de thèmes récents — rendent la même galerie plusieurs
   * fois : une grille pour le bureau, un carrousel pour le mobile, une vue
   * zoomée. Ces rendus n'existent pas tous au moment où notre script tourne :
   * sur un produit à quatorze médias, seuls quatre nœuds étaient marqués, et le
   * client voyait les photos des autres coloris dans la grille.
   *
   * On observe donc l'arrivée de nouveaux nœuds — `childList` seulement. Écouter
   * les attributs nous ferait réagir à nos propres classes, en boucle.
   */
  Variantsy.prototype.watchGallery = function (variant) {
    var self = this;
    var cible = this.collectMediaNodes().gallery || this.scope;
    if (!cible || typeof MutationObserver === "undefined") return;

    var enAttente = null;
    var reappliquer = function () {
      if (enAttente) return;
      enAttente = setTimeout(function () {
        enAttente = null;
        try {
          self.applyGallery(self.findVariantByOptions(self.selection) || variant);
        } catch (error) {
          /* une galerie récalcitrante ne doit pas emporter la page */
        }
      }, 60);
    };

    new MutationObserver(reappliquer).observe(cible, { childList: true, subtree: true });

    // Filet indépendant de l'observateur : un thème qui rend sa grille avant
    // notre script, mais après le parse du DOM, ne déclencherait aucune mutation.
    if (document.readyState !== "complete") {
      window.addEventListener("load", reappliquer, { once: true });
    }
    setTimeout(reappliquer, 400);
  };

  /* ---------------------------------------------------------------------- */
  /* Amorçage                                                               */
  /* ---------------------------------------------------------------------- */

  function boot() {
    var roots = document.querySelectorAll("[data-variantsy]:not([data-variantsy-ready])");
    if (!roots.length) return;

    var endpoint = roots[0].getAttribute("data-endpoint") || "/apps/variantsy/settings";

    loadConfig(endpoint).then(function (config) {
      if (!config.enabled) return;
      Array.prototype.forEach.call(roots, function (root) {
        root.setAttribute("data-variantsy-ready", "true");
        try {
          new Variantsy(root, config).start();
        } catch (error) {
          console.error("[Variantsy] initialisation impossible", error);
          root.removeAttribute("data-variantsy-ready");
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Thèmes à navigation Ajax / rechargement de section (Dawn, Horizon…).
  document.addEventListener("shopify:section:load", boot);
  document.addEventListener("shopify:block:select", boot);

  // Exposé pour les tests automatisés et pour le support (console navigateur).
  window.Variantsy = {
    renderTemplate: renderTemplate,
    normalize: normalize,
    computeGroups: computeGroups,
    visibleMediaFor: visibleMediaFor,
  };
})();
