# Reprise du projet dans Claude Code — Variantsy

Ce fichier résume la conversation qui a produit ce repo, pour reprendre le travail
dans Claude Code (CLI) sans perdre le contexte métier. **Le detail technique
complet (architecture, pièges, commandes) est déjà dans `CLAUDE.md` à la racine
— lis-le en premier, systématiquement, avant toute modification.** Ce fichier-ci
couvre ce que `CLAUDE.md` ne couvre pas : le contexte produit/business qui a mené
aux choix actuels, et ce qui reste en suspens.

---

## 1. Ce qu'est le projet

**Variantsy** (anciennement nommée "VariantPop" pendant le développement — le
rebrand est fait dans tout le code, voir §4) est une app Shopify qui fusionne
les fonctionnalités de deux apps existantes du App Store :

- **Variant Image Automator** → galeries multi-images par variante, groupage
  automatique des médias sans configuration produit par produit.
- **Variant Title King** → titre de produit dynamique via template avec
  variables et blocs conditionnels.
- Un **sélecteur de swatches** (couleur/image) est gardé en bonus, hérité
  d'une V1 plus simple du projet.

Le projet a été conçu explicitement pour éviter les 5 pièges qui ont fait
perdre du temps sur une app précédente (LiquidPop) : deux pipelines de
déploiement indépendants, migrations Prisma non jouées par Vercel, cache de
connexion Neon figé après un cold-start, gate de billing qui ne se déclenche
qu'à la première visite, reset CSS des boutons custom absent dès la V1. Ces
5 points sont documentés en détail (avec le code qui les corrige) dans
`CLAUDE.md` §2 à §6 — ne pas les redécouvrir à la dure une deuxième fois.

Stack : Remix + Prisma + PostgreSQL Neon + Vercel (admin), theme app
extension en Liquid/JS/CSS vanilla (storefront), Shopify Managed Pricing
(plan unique + essai).

## 2. État de vérification actuel

- `npm run typecheck` (`tsc --noEmit`) : propre.
- `npm run test` (smoke test Playwright dans un vrai Chromium, simule un thème
  façon Dawn) : **71/71 tests passent**, y compris la comparaison croisée entre
  les deux implémentations du moteur de groupage (storefront vs admin — voir
  `CLAUDE.md` §7, section « deux duplications assumées »).
- Le repo n'a **jamais été déployé réellement** (ni `shopify app deploy`, ni
  push vers un vrai projet Vercel, ni migration jouée sur une vraie base Neon).
  Tout le travail jusqu'ici est du scaffolding + tests locaux/simulés.
- `client_id` dans `shopify.app.toml` est un placeholder
  (`REMPLACER_PAR_LE_CLIENT_ID`) : il faut lancer `shopify app config link`
  (ou `npm run config:link`) avant tout `npm run dev` ou déploiement réel.

## 3. Décisions produit prises pendant la conversation

**Périmètre fonctionnel** : galeries multi-images (priorité commerciale n°1,
groupage par ordre des médias + repli sur texte alternatif), titre dynamique
(n°2), swatches gardés en bonus (n°3).

**Nom de l'app : Variantsy.** Étapes de vérification faites avant de trancher :
- Recherche de noms alternatifs à "VariantPop" pour éviter la confusion avec
  les apps existantes (Variant Image Automator, Variant Title King, Rubik
  Variant Images, OP Color Swatch, etc.).
- Un premier candidat, **"Variantly"**, a été écarté : bien qu'absent du
  Shopify App Store, ce nom est déjà utilisé par au moins 3 produits SaaS actifs
  (variantly.io, usevariantly.com, variantly.app) et son `.com` est en vente à
  4 995 $ — trop encombré pour construire une marque propre.
- **Variantsy** a été vérifié : aucune app à ce slug sur
  `apps.shopify.com/variantsy` (404), `variantsy.com` ne résolvait pas en DNS
  au moment du check (probablement libre à l'enregistrement).
- ⚠️ **Ce qui n'a PAS été fait et reste à faire avant tout dépôt officiel** :
  vérification définitive dans le Partner Dashboard au moment de la création
  de la fiche (seule source de vérité réelle sur la disponibilité du nom côté
  Shopify), recherche de marque déposée formelle (INPI/USPTO), vérification
  de la disponibilité des réseaux sociaux.
- Le rebrand technique complet (code, config, assets, docs) de VariantPop vers
  Variantsy a été appliqué et re-testé (71/71 toujours au vert après coup) :
  handle, subpath d'app proxy (`/apps/variantsy/settings`), nom du package npm,
  fichiers `variantsy.js`/`variantsy.css`, préfixe de variables CSS
  (`--vtsy-*`), classe JS `Variantsy` / `window.Variantsy`.

**Pricing** : le modèle de facturation (Shopify Managed Pricing, plan unique +
essai) était déjà arrêté avant le rebrand. Recherche de prix pratiqués par la
concurrence directe en août 2026 :

| App | Fourchette |
|---|---|
| Rubik Variant Images | 0 (1 produit) → 75 $/mois |
| OP Color Swatch | 11,90 → 99,90 $/mois |
| SA Variant Image Automator | 5 → 99,90 $/mois |
| Variant Image Wizard | 4,99 → 7,99 $/mois |
| Easy Variant Images | 7,50 → 19,50 $/mois |
| NS Color Swatch | gratuit → 14,99 $/mois |
| Variant Title King | entièrement gratuite |

Recommandation faite : **14,90 $ à 19,90 $/mois** en plan unique (positionnement
au-dessus des apps d'entrée de gamme, en dessous des paliers hauts des apps à
tiroirs, puisque Variantsy combine plus de valeur qu'aucune app seule et n'a
pas de palier "gros volume" à justifier), avec une option repli à 9,90 $/mois
si la priorité est d'accumuler des avis rapidement au lancement. **Aucun prix
n'a encore été configuré dans le Partner Dashboard** — c'est une recommandation,
pas une action effectuée.

**Hébergement** : question posée sur la viabilité de Vercel Hobby + Neon Free
en production. Conclusion (recherche, pas de changement de code) : viable pour
le développement et la review App Store, **pas viable commercialement** —
Vercel Hobby interdit l'usage commercial dans ses CGU, et Neon Free (100
CU-heures/mois, scale-to-zero à 5 min obligatoire) plafonne à ~400 heures
d'éveil/mois, ce qu'une poignée de boutiques actives peut épuiser. L'app
dégrade proprement côté storefront (le proxy ne renvoie jamais de 5xx) mais
l'admin et les fonctionnalités liées à la base (swatches, titres custom)
casseraient pendant une suspension Neon. Recommandation : migrer vers Vercel
Pro + Neon Launch (payant, zéro changement de code) ou Railway (moins cher,
demande de réécrire la section déploiement de `CLAUDE.md` et `scripts/deploy.sh`)
avant d'onboarder des marchands payants. **Aucune décision finale prise, aucun
changement de code fait sur ce point.**

## 4. Ce qui reste ouvert / non tranché

Ce sont des questions posées à l'utilisateur pendant la conversation, jamais
répondues — à reproposer ou à trancher directement dans Claude Code :

1. **Pages de collection** : ni Variant Image Automator ni Variantsy n'agissent
   sur les vignettes de collection (uniquement la page produit aujourd'hui).
   Identifié comme la demande n°1 qui reviendra côté utilisateurs.
2. **Overrides de groupage par produit** : le groupage est aujourd'hui
   entièrement déduit automatiquement, sans possibilité de correction manuelle
   pour un produit atypique. Une table `ProductGroupOverride` réglerait ça.
3. **Variante de déploiement Railway** : à préparer seulement si la décision
   d'hébergement penche vers Railway plutôt que Vercel Pro + Neon Launch.
4. Nom **Variantsy** : à valider définitivement dans le Partner Dashboard +
   recherche de marque avant tout dépôt de fiche App Store.
5. **Prix** : à configurer réellement dans Partner Dashboard → Pricing (la
   checklist complète de publication est dans `CLAUDE.md` §5).

## 5. Pour démarrer dans Claude Code

> **Fait le 17 août 2026** : repo dézippé dans `~/Documents/variantsy`,
> `npm install` joué, `npm run typecheck` propre, `npm run test` à 71/71
> (il faut `npx playwright install chromium` au préalable), dépôt git
> initialisé avec l'état livré en premier commit. Restent le
> `npm run config:link` de l'étape 3 et toute l'étape 5.

1. Dézipper le repo livré (`variantsy.zip`).
2. Lire `CLAUDE.md` en entier (architecture, les 5 pièges, structure des
   fichiers, commandes, checklist de soumission App Store).
3. `npm install`, puis `npm run config:link` pour lier un vrai client Shopify
   (le `client_id` actuel est un placeholder).
4. `npm run typecheck` et `npm run test` pour confirmer que l'état livré est
   toujours sain avant de commencer à modifier.
5. Attaquer un des points de la section 4 ci-dessus, ou reprendre la
   configuration réelle (Partner Dashboard, base Neon, projet Vercel) qui
   n'a encore jamais été faite pour de vrai.
