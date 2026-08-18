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
  function handleDe(lien) {
    var trouve = (lien.getAttribute("href") || "").match(/\/products\/([^/?#]+)/);
    return trouve ? trouve[1] : null;
  }

  /** Le produit a-t-il ici un lien SANS image — typiquement son titre ? */
  function aUnLienTexte(element, handle) {
    var liens = element.querySelectorAll('a[href*="/products/"]');
    for (var i = 0; i < liens.length; i++) {
      if (handleDe(liens[i]) === handle && !liens[i].querySelector("img")) return true;
    }
    return false;
  }

  /** Cet élément abrite-t-il un lien vers un AUTRE produit que celui-ci ? */
  function contientAutreProduit(element, handle) {
    var liens = element.querySelectorAll('a[href*="/products/"]');
    for (var i = 0; i < liens.length; i++) {
      var autre = handleDe(liens[i]);
      if (autre && autre !== handle) return true;
    }
    return false;
  }

  /**
   * Une carte produit est le plus GRAND conteneur qui n'appartient qu'à un
   * seul produit.
   *
   * Deux règles ont échoué avant celle-ci. « Le plus petit conteneur portant
   * une image » tombait sur le bloc photo, sans le retrait du texte. « Le plus
   * petit réunissant tous les liens du produit » remontait jusqu'à la grille
   * entière sur les thèmes qui répètent leurs liens ailleurs — tiroir d'achat
   * rapide, aperçu rapide — et se faisait écarter : deux vignettes sur quatorze
   * recevaient leurs pastilles.
   *
   * S'arrêter dès qu'un autre produit entre dans le cadre donne exactement la
   * carte, quelle que soit la façon dont le thème la construit.
   */
  function trouverCartes(racine) {
    var liens = racine.querySelectorAll('a[href*="/products/"]');
    var vus = {};
    var cartes = [];

    Array.prototype.forEach.call(liens, function (lien) {
      var handle = handleDe(lien);
      if (!handle || vus[handle]) return;

      var noeud = lien;
      var carte = null;
      for (var i = 0; i < 8 && noeud.parentElement; i++) {
        var parent = noeud.parentElement;
        // Premier signal d'arrêt : un autre produit entre dans le cadre.
        if (parent === document.body || contientAutreProduit(parent, handle)) break;
        noeud = parent;
        if (!noeud.querySelector("img")) continue;
        carte = noeud;
        // Second signal : ce conteneur réunit déjà l'image ET un lien texte,
        // donc c'est la carte. Sans lui, une page ne portant qu'un seul
        // produit laisserait la remontée aller jusqu'à la grille.
        if (aUnLienTexte(noeud, handle)) break;
      }
      if (!carte) return;
      vus[handle] = true;
      cartes.push({ carte: carte, lien: lien, handle: handle });
    });

    return cartes;
  }

  /** Données produit servies par Shopify, mises en cache par handle. */
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
    // Une vignette de collection est petite : tout est réduit d'un même
    // facteur, liseré compris. Le laisser à sa taille de page produit lui
    // faisait occuper un sixième du diamètre de la pastille.
    var echelle = 0.95;
    var taille = Math.round((style.size || 40) * echelle);
    conteneur.style.setProperty("--vtsy-size", taille + "px");
    conteneur.style.setProperty("--vtsy-gap", Math.max(4, Math.round((style.gap || 10) * echelle)) + "px");
    conteneur.style.setProperty(
      "--vtsy-selected-width",
      Math.max(1, Math.round((style.selectedWidth || 2) * echelle)) + "px",
    );
    conteneur.style.setProperty(
      "--vtsy-selected-gap",
      Math.max(1, Math.round((style.selectedGap || 2) * echelle)) + "px",
    );
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

    if ((style.collectionPlacement || "overlay") === "overlay") {
      // Le survol ne s'applique qu'en surimpression : sous la carte, une
      // rangée qui apparaît pousserait le contenu à chaque passage de souris.
      if (style.collectionReveal === "hover") {
        conteneur.classList.add("variantsy-collection--survol");
      }
      poserSurLaPhoto(entree.carte, conteneur);
    } else {
      entree.carte.appendChild(conteneur);
      aligner(entree.carte, conteneur);
    }
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


  /**
   * Pose la rangée en surimpression, au bas de la photo.
   *
   * C'est le placement retenu par la plupart des apps de ce marché, et pour
   * une raison simple : sous le bloc de texte, les pastilles allongent la
   * carte et se noient dans le reste. Sur la photo, elles se voient sans rien
   * déplacer.
   *
   * On remonte de l'image jusqu'à son conteneur direct plutôt que d'utiliser
   * la carte entière : ancrer au bas de la carte poserait la rangée sous le
   * prix, ce qui est justement ce qu'on veut éviter.
   */
  function poserSurLaPhoto(carte, conteneur) {
    var image = carte.querySelector("img");
    if (!image) {
      carte.appendChild(conteneur);
      return;
    }

    // On cherche le conteneur qui donne sa hauteur à l'image, en écartant les
    // éléments en ligne : un <a> non converti en bloc a une boîte qui ne suit
    // pas son contenu, et la rangée s'y ancre de travers.
    var hote = image.parentElement;
    for (var i = 0; i < 4 && hote && hote !== carte.parentElement; i++) {
      var boite = hote.getBoundingClientRect();
      var affichage = "block";
      try {
        affichage = window.getComputedStyle(hote).display;
      } catch (error) {
        /* noop */
      }
      var enLigne = affichage === "inline";
      if (!enLigne && boite.height >= image.getBoundingClientRect().height - 2) break;
      hote = hote.parentElement;
    }
    if (!hote || hote === document.body || !carte.contains(hote)) hote = carte;

    // `position: static` empêcherait l'ancrage. On ne l'impose que si le thème
    // ne l'a pas déjà défini, pour ne pas casser une mise en page existante.
    try {
      if (window.getComputedStyle(hote).position === "static") {
        hote.style.position = "relative";
      }
    } catch (error) {
      /* noop */
    }

    conteneur.classList.add("variantsy-collection--surimpression");
    hote.appendChild(conteneur);
  }

  /**
   * Aligne la rangée sur le texte de la vignette.
   *
   * Une marge fixe serait fausse partout : selon le thème, le titre est collé
   * au bord ou retiré de vingt pixels, et notre rangée doublerait la seconde
   * tout en laissant la première à ras. On mesure donc le décalage réel du
   * titre et on l'applique — ce qui s'ajuste seul, quel que soit le thème.
   */
  function aligner(carte, conteneur) {
    var texte = null;
    // `:has()` n'existe pas sur les navigateurs anciens et fait lever le
    // sélecteur entier. On l'isole donc, pour que son absence ne prive pas du
    // repli qui suit.
    try {
      texte = carte.querySelector("a[href*='/products/']:not(:has(img))");
    } catch (error) {
      texte = null;
    }
    if (!texte) {
      texte = carte.querySelector("h2, h3, [class*='title'], [class*='titre']");
    }
    if (!texte) return;

    try {
      var decalage = Math.round(
        texte.getBoundingClientRect().left - carte.getBoundingClientRect().left,
      );
      // Au-delà de 60 px on soupçonne une mesure aberrante — mieux vaut ne
      // rien faire que décaler une rangée au milieu de la vignette.
      if (decalage > 0 && decalage <= 60) {
        conteneur.style.paddingInlineStart = decalage + "px";
        conteneur.style.paddingInlineEnd = decalage + "px";
      }
    } catch (error) {
      /* sélecteur non supporté par un vieux navigateur : on laisse tel quel */
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
