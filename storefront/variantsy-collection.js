/* ==========================================================================
   Variantsy — pastilles sur les pages de collection

   Fichier SÉPARÉ de variantsy.js, et c'est délibéré : la page produit est
   déjà au-dessus du seuil de poids de Shopify, et ce code ne la concerne pas.
   Il n'est chargé que par l'app embed, sur les pages qui listent des produits.

   Principe : le thème rend ses vignettes comme il l'entend. On ne réécrit
   rien — on repère les cartes produit, on va chercher les données de chaque
   produit auprès de Shopify, et on greffe une rangée de pastilles. Cliquer
   change l'image de la carte et pointe son lien vers la bonne variante.

   Prudence : tout est enveloppé de try/catch et chargé paresseusement. Une
   page de collection qui plante, c'est un catalogue entier inaccessible.
   ========================================================================== */

(function () {
  "use strict";

  var CACHE_KEY = "variantsy:config:v3";
  var PRODUIT_CACHE = {};

  /* ---------------------------------------------------------------------- */
  /* Utilitaires — volontairement dupliqués depuis variantsy.js              */
  /*                                                                        */
  /* Les deux fichiers sont des assets autonomes servis par le CDN Shopify : */
  /* ils ne peuvent rien s'importer l'un l'autre. Ces trois fonctions sont   */
  /* courtes et stables ; les factoriser demanderait un bundler pour une     */
  /* économie de quelques lignes.                                            */
  /* ---------------------------------------------------------------------- */

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  function estCouleurCss(value) {
    if (!value) return null;
    var texte = String(value).trim();
    if (/^#[0-9a-f]{3,8}$/i.test(texte)) return texte;
    if (/^rgba?\(/i.test(texte) && texte.indexOf(")") !== -1) return texte;
    return null;
  }

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

  /* ---------------------------------------------------------------------- */
  /* Configuration                                                          */
  /* ---------------------------------------------------------------------- */

  function lireCache() {
    try {
      var brut = window.sessionStorage.getItem(CACHE_KEY);
      if (!brut) return null;
      var enveloppe = JSON.parse(brut);
      if (Date.now() - enveloppe.t > 5 * 60 * 1000) return null;
      return enveloppe.c;
    } catch (error) {
      return null;
    }
  }

  function chargerConfig(endpoint) {
    var cache = lireCache();
    if (cache) return Promise.resolve(cache);
    return fetch(endpoint, { headers: { accept: "application/json" } })
      .then(function (r) {
        return r.json();
      })
      .then(function (config) {
        try {
          window.sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ t: Date.now(), c: config }),
          );
        } catch (error) {
          /* stockage plein ou navigation privée : on continue sans cache */
        }
        return config;
      });
  }

  /* ---------------------------------------------------------------------- */
  /* Repérage des cartes produit                                            */
  /* ---------------------------------------------------------------------- */

  /**
   * Une carte produit est le plus petit conteneur qui abrite à la fois un
   * lien vers un produit et une image. On remonte depuis le lien plutôt que
   * de deviner des noms de classes, qui changent d'un thème à l'autre.
   */
  function trouverCartes(racine) {
    var liens = racine.querySelectorAll('a[href*="/products/"]');
    var candidats = [];

    Array.prototype.forEach.call(liens, function (lien) {
      var handle = (lien.getAttribute("href") || "").match(/\/products\/([^/?#]+)/);
      if (!handle) return;

      var noeud = lien;
      var carte = null;
      for (var i = 0; i < 6 && noeud && noeud.parentElement; i++) {
        noeud = noeud.parentElement;
        if (noeud.querySelector("img")) {
          carte = noeud;
          break;
        }
      }
      if (!carte) return;
      candidats.push({ carte: carte, lien: lien, handle: handle[1] });
    });

    // Une carte porte plusieurs liens — l'image, le titre — et chacun remonte
    // vers un ancêtre différent. Sans ce tri, la même vignette recevait trois
    // rangées de pastilles. On ne garde que le conteneur le plus INTERNE de
    // chaque famille, et un seul par produit.
    var retenus = [];
    candidats.forEach(function (candidat) {
      var remplace = false;
      for (var i = 0; i < retenus.length; i++) {
        var deja = retenus[i];
        if (deja.carte === candidat.carte) return;
        if (deja.carte.contains(candidat.carte)) {
          // Le nouveau est plus interne : il prend la place de l'ancien.
          retenus[i] = candidat;
          remplace = true;
          break;
        }
        if (candidat.carte.contains(deja.carte)) return; // l'ancien est meilleur
      }
      if (!remplace) retenus.push(candidat);
    });

    return retenus;
  }

  function chargerProduit(handle) {
    if (PRODUIT_CACHE[handle]) return PRODUIT_CACHE[handle];
    PRODUIT_CACHE[handle] = fetch("/products/" + handle + ".js")
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
    return PRODUIT_CACHE[handle];
  }

  /* ---------------------------------------------------------------------- */
  /* Rendu                                                                  */
  /* ---------------------------------------------------------------------- */

  /** Photo de la première variante portant cette valeur. */
  function photoPour(produit, index, valeur) {
    for (var i = 0; i < produit.variants.length; i++) {
      var v = produit.variants[i];
      if (v.options[index] === valeur && v.featured_image && v.featured_image.src)
        return v.featured_image.src;
    }
    return null;
  }

  function couleurPour(config, nomOption, valeur) {
    var cle = normalize(nomOption) + "::" + normalize(valeur);
    var swatch = (config.swatches || {})[cle];
    if (swatch) {
      if (swatch.kind === "image" && swatch.img) return { image: swatch.img };
      if (swatch.kind === "gradient" && swatch.c1 && swatch.c2)
        return { degrade: [swatch.c1, swatch.c2] };
      if (swatch.c1) return { couleur: swatch.c1 };
    }
    var direct = estCouleurCss(valeur);
    if (direct) return { couleur: direct };
    var devine = guessColorFrom(config.colors, valeur);
    if (devine) return { couleur: devine };
    return null;
  }

  function indexOptionCouleur(produit, config) {
    var noms = config.colorOptions || [];
    for (var i = 0; i < produit.options.length; i++) {
      var option = produit.options[i];
      var nom = typeof option === "string" ? option : option.name;
      if (noms.indexOf(normalize(nom)) !== -1) return i;
    }
    // Repli : l'option dont au moins une valeur se reconnaît comme couleur.
    for (var j = 0; j < produit.options.length; j++) {
      var opt = produit.options[j];
      var valeurs = typeof opt === "string" ? [] : opt.values || [];
      for (var k = 0; k < valeurs.length; k++) {
        if (couleurPour(config, typeof opt === "string" ? opt : opt.name, valeurs[k])) return j;
      }
    }
    return -1;
  }

  function construire(entree, produit, config) {
    var index = indexOptionCouleur(produit, config);
    if (index === -1) return;

    var option = produit.options[index];
    var nomOption = typeof option === "string" ? option : option.name;
    var valeurs = typeof option === "string" ? [] : option.values || [];
    // Une seule valeur : rien à choisir, on n'encombre pas la carte.
    if (valeurs.length < 2) return;

    var style = config.style || {};
    var conteneur = document.createElement("div");
    conteneur.className = "variantsy-collection";
    conteneur.setAttribute("data-variantsy-collection", "");
    conteneur.style.setProperty("--vtsy-size", (style.size || 40) * 0.6 + "px");
    conteneur.style.setProperty("--vtsy-gap", (style.gap || 10) * 0.6 + "px");
    conteneur.style.setProperty("--vtsy-selected-color", style.selectedColor || "#111111");
    conteneur.style.setProperty(
      "--vtsy-radius",
      style.shape === "square" ? "0px" : style.shape === "rounded" ? "6px" : "50%",
    );

    valeurs.forEach(function (valeur, rang) {
      var bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "variantsy-collection__swatch" + (rang === 0 ? " is-selected" : "");
      bouton.setAttribute("aria-label", nomOption + " : " + valeur);
      bouton.title = valeur;

      var visuel = document.createElement("span");
      visuel.className = "variantsy-collection__visual";
      var rendu = couleurPour(config, nomOption, valeur);
      // Aucune couleur connue : on retombe sur la photo de la variante, comme
      // le fait la page produit. Une vignette vaut mieux qu'un rond gris.
      if (!rendu) {
        var photo = photoPour(produit, index, valeur);
        if (photo) rendu = { image: photo };
      }
      if (rendu && rendu.image) visuel.style.backgroundImage = 'url("' + rendu.image + '")';
      else if (rendu && rendu.degrade)
        visuel.style.backgroundImage =
          "linear-gradient(135deg," + rendu.degrade[0] + " 0 50%," + rendu.degrade[1] + " 50%)";
      else if (rendu && rendu.couleur) visuel.style.backgroundColor = rendu.couleur;
      else visuel.style.backgroundColor = style.neutralColor || "#ECECEC";
      bouton.appendChild(visuel);

      bouton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        appliquer(entree, produit, index, valeur, conteneur);
      });

      conteneur.appendChild(bouton);
    });

    // Dernier contrôle avant greffe : le repérage est synchrone, l'injection
    // ne l'est pas. Deux cartes imbriquées ayant échappé au tri produiraient
    // sinon deux rangées.
    if (entree.carte.querySelector("[data-variantsy-collection]")) return;
    entree.carte.appendChild(conteneur);
  }

  /**
   * Applique un coloris à la carte : image échangée, lien pointé vers la
   * variante. On ne touche jamais au panier depuis une page de collection —
   * le client doit passer par la fiche produit, où le choix est explicite.
   */
  function appliquer(entree, produit, index, valeur, conteneur) {
    try {
      var variante = null;
      for (var i = 0; i < produit.variants.length; i++) {
        if (produit.variants[i].options[index] === valeur) {
          variante = produit.variants[i];
          break;
        }
      }
      if (!variante) return;

      var image = entree.carte.querySelector("img");
      if (image && variante.featured_image && variante.featured_image.src) {
        image.setAttribute("src", variante.featured_image.src);
        image.removeAttribute("srcset");
      }

      var liens = entree.carte.querySelectorAll('a[href*="/products/"]');
      Array.prototype.forEach.call(liens, function (lien) {
        var base = (lien.getAttribute("href") || "").split("?")[0];
        lien.setAttribute("href", base + "?variant=" + variante.id);
      });

      var boutons = conteneur.querySelectorAll(".variantsy-collection__swatch");
      Array.prototype.forEach.call(boutons, function (bouton) {
        bouton.classList.toggle("is-selected", bouton.title === valeur);
      });
    } catch (error) {
      /* une carte récalcitrante ne doit pas emporter la page */
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Démarrage                                                              */
  /* ---------------------------------------------------------------------- */

  function demarrer() {
    var racine = document.querySelector("[data-variantsy-collection-root]");
    if (!racine) return;
    var endpoint = racine.getAttribute("data-endpoint") || "/apps/variantsy/settings";

    chargerConfig(endpoint)
      .then(function (config) {
        if (!config || config.enabled === false) return;

        var cartes = trouverCartes(document);
        if (!cartes.length) return;

        // Chargement paresseux : sur une collection de 48 produits, tout
        // charger d'un coup ferait 48 requêtes avant le premier affichage.
        var observer =
          "IntersectionObserver" in window
            ? new IntersectionObserver(
                function (entrees) {
                  entrees.forEach(function (e) {
                    if (!e.isIntersecting) return;
                    observer.unobserve(e.target);
                    var entree = cartes.filter(function (c) {
                      return c.carte === e.target;
                    })[0];
                    if (entree) traiter(entree, config);
                  });
                },
                { rootMargin: "200px" },
              )
            : null;

        cartes.forEach(function (entree) {
          if (observer) observer.observe(entree.carte);
          else traiter(entree, config);
        });
      })
      .catch(function () {
        /* configuration injoignable : la collection reste intacte */
      });
  }

  function traiter(entree, config) {
    chargerProduit(entree.handle).then(function (produit) {
      if (!produit || !produit.options || !produit.variants) return;
      try {
        construire(entree, produit, config);
      } catch (error) {
        /* noop */
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", demarrer);
  } else {
    demarrer();
  }
})();
