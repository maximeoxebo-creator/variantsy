# CLAUDE.md — Variantsy

Instructions pour tout agent (ou humain) qui travaille sur ce dépôt.
**À lire en entier avant la première modification.** Ce fichier existe parce que
l'app précédente (LiquidPop) a perdu des jours sur des pièges tous listés ici.

---

## 1. Ce que fait l'app

Variantsy fait trois choses sur la page produit, par ordre d'importance
commerciale :

1. **Plusieurs images par variante.** Shopify n'en autorise qu'une nativement.
   Variantsy regroupe les médias et filtre la galerie du thème pour n'afficher
   que ceux du coloris choisi. Aucune configuration produit par produit : le
   groupage se déduit de l'ordre des médias, avec repli sur le texte alternatif.
2. **Titre produit dynamique**, réécrit selon un template marchand avec
   variables et blocs conditionnels.
3. **Swatches** — sélecteur de variantes en pastilles couleur ou image.

- Admin : Remix + Polaris, hébergé sur Vercel
- Storefront : theme app extension (bloc Liquid + JS/CSS vanilla)
- Données : PostgreSQL Neon via Prisma
- Config storefront : servie par **app proxy** (`/apps/variantsy/settings`)

---

## 2. ⚠️ LES DEUX PIPELINES DE DÉPLOIEMENT (piège n°1)

**Avant tout déploiement, se poser LA question : « est-ce que je touche à
l'admin ou à l'extension ? »** Les deux systèmes sont totalement indépendants.

| Ce que tu modifies | Comment ça se déploie |
|---|---|
| `app/**` (routes Remix, `*.server.ts`), `prisma/**`, `package.json`, `vercel.json` | **`git push`** → Vercel déploie automatiquement |
| `extensions/**` (Liquid, JS/CSS storefront), `shopify.app.toml` | **`npm run deploy:extension`** (= `shopify app deploy --force`) — **PAS déployé par git push** |

Le `--force` est nécessaire en environnement non interactif (CI, agent).

**Si tu touches aux deux : `npm run deploy:all`** (voir `scripts/deploy.sh`),
qui enchaîne push → migration → déploiement d'extension dans le bon ordre.

Symptôme typique de l'oubli : « j'ai modifié le fichier .liquid, j'ai pushé,
et rien n'a changé sur la boutique ». C'est normal. Lance
`npm run deploy:extension`.

---

## 3. ⚠️ MIGRATIONS PRISMA (piège n°2)

Sur LiquidPop, `prisma generate` était dans le script `build`, mais
**`generate` ≠ `migrate`**. Vercel ne joue jamais les migrations tout seul :
le code déployé attendait un schéma que la prod n'avait pas → crash.

**Ici c'est câblé** : `package.json` définit

```json
"vercel-build": "prisma generate && prisma migrate deploy && remix vite:build"
```

et `vercel.json` force `buildCommand: "npm run vercel-build"`.

**Les deux règles à ne jamais enfreindre :**

1. Ne **pas** changer le Build Command dans le dashboard Vercel — le réglage du
   dashboard écrase `vercel.json` et la migration sautera silencieusement.
2. Après un push contenant une nouvelle migration, **vérifier** que le build
   Vercel affiche bien les lignes `prisma migrate deploy`. En cas de doute,
   filet de sécurité manuel :

```bash
npm run db:deploy   # = set -a && . ./.env && set +a && npx prisma migrate deploy
```

Attention : `.env` local doit pointer sur la **même base Neon que la prod**.
Vérifier `DATABASE_URL` avant de lancer la commande.

Note Neon : `DATABASE_URL` utilise l'endpoint **poolé** (`-pooler`), `DIRECT_URL`
l'endpoint direct. Les migrations passent par `DIRECT_URL` — pgbouncer ne
supporte pas les DDL en mode transaction.

---

## 4. ⚠️ NEON SCALE-TO-ZERO (piège n°3)

Le plan gratuit Neon endort le compute après **5 minutes d'inactivité**. Ce
n'est pas configurable sans passer au payant.

Symptôme trompeur : `MissingSessionTableError` /
`PrismaClientInitializationError` alors que la table existe. La vraie cause est
un **timeout pendant le réveil du compute**.

Aggravant : `PrismaSessionStorage` met en cache son test de connexion
(`pollForTable`) pour toute la durée de vie de l'instance serverless. Un seul
échec pendant un cold-start reste figé et fait planter **toutes** les requêtes
suivantes sur cette instance jusqu'à ce que Vercel la recycle → pannes qui
semblent aléatoires et qui « se réparent toutes seules ».

**Trois garde-fous sont déjà en place :**

1. `app/shopify.server.ts` — `connectionRetries: 5`, `connectionRetryIntervalMs: 3000`
   (~15 s de marge contre 10 s par défaut). **Ne pas baisser ces valeurs** : elles
   ne coûtent rien quand la base répond.
2. `app/db.server.ts` — helper `withRetry()` avec backoff exponentiel, utilisé
   par toutes les requêtes du chemin critique.
3. `app/routes/proxy.settings.ts` — ne renvoie **jamais** de 5xx : si la base est
   injoignable, il sert les valeurs par défaut avec un cache court.

**Décision à prendre avant le lancement commercial** : dès que l'app a du vrai
trafic marchand, passer sur un plan Neon payant (pas de scale-to-zero). Un
cold-start = un marchand qui voit une erreur au premier chargement = une
désinstallation.

---

## 5. ⚠️ BILLING / MANAGED PRICING (piège n°4 — rejet App Store réel, réf. 125316, règle 1.2.1)

LiquidPop a été rejeté parce que la facturation n'était pas détectable par le
reviewer. Deux causes cumulées :

1. **Code** : la redirection vers la page de pricing ne se déclenchait qu'à la
   toute première visite → invisible dès la 2e.
2. **Config** : le plan Managed Pricing était resté en **brouillon**.

**Ce qui est en place ici :**

- `app/billing.server.ts` → `requireActivePlan()`
- appelé dans le loader de `app/routes/app.tsx`, c'est-à-dire le layout racine :
  **toutes** les pages de l'app passent par ce gate, **à chaque chargement**.
- la vérification interroge Shopify (`currentAppInstallation.activeSubscriptions`),
  jamais notre base : aucun état local ne peut désynchroniser le gate.
- Shopify marque les abonnements en essai comme `ACTIVE` → tester « le tableau
  n'est pas vide » couvre trial + payant, pas besoin de logique spécifique.

**Ne jamais transformer ce gate en « seulement à la première visite ».**

### Checklist Partner Dashboard avant la première soumission

- [ ] Plan Managed Pricing **publié** — Partner Dashboard → Pricing →
      « Update to App Pricing » → étape 2 « Enable Shopify App Pricing ».
- [ ] Vérifier le badge **« App Pricing enabled »** (et pas seulement
      « Draft and test plans »).
- [ ] `SHOPIFY_APP_HANDLE` dans les variables Vercel = le handle réel de l'app
      (celui de l'URL `/charges/<handle>/pricing_plans`).
- [ ] **Internal plan handle** (ex. `pro`) : choisi une bonne fois pour toutes,
      il n'est **plus modifiable** après création.
- [ ] Durée d'essai décidée avant publication — la changer après nécessite de
      rééditer le plan public.
- [ ] `redirect_url` du plan → une route réelle de l'app (`/app`).

---

## 6. ⚠️ BOUTONS CUSTOM (piège n°5)

Tout `<button>` au style minimal/transparent doit reset ces quatre propriétés
**dès la première version**, sinon on passe des heures à chasser un « fond gris »
qui est en réalité le chrome natif du navigateur :

```css
-webkit-appearance: none;
appearance: none;
outline: none;
-webkit-tap-highlight-color: transparent;
```

C'est déjà fait dans `extensions/variant-engine/assets/variantsy.css`
(`.variantsy__swatch`, `.variantsy__more`) et dans les boutons React de l'admin.
Le focus clavier est rendu séparément via `:focus-visible` — ne pas le supprimer,
c'est un point d'accessibilité vérifié par le review Shopify.

**Deuxième partie du piège** : plusieurs boutons sur une même ligne flex avec
ajustement automatique de la police. Réduire le premier libère de l'espace, donc
le second (mesuré ensuite) n'a plus besoin de rétrécir → tailles incohérentes.

**Fix obligatoire en deux passes** : mesurer individuellement, puis
**synchroniser tous les boutons de la ligne sur la police minimale obtenue**.
Implémenté dans `syncFontSizes()` (`variantsy.js`). Si tu ajoutes un autre
groupe de boutons auto-ajustés, applique la même logique.

---

## 7. Architecture des fichiers

```
app/
  shopify.server.ts       # shopifyApp() + PrismaSessionStorage (retries Neon)
  billing.server.ts       # requireActivePlan() — gate App Store
  db.server.ts            # singleton Prisma + withRetry()
  settings.server.ts      # lecture/écriture réglages + sérialisation storefront
  colors.ts               # dictionnaire noms de couleurs FR/EN → hex
  grouping.js             # moteur de groupage des médias (ESM, testable en Node)
  shared.ts               # normalize() + moteur de templates de titre
  components/
    SwatchPreview.tsx     # aperçu live partagé admin
  routes/
    app.tsx               # layout racine + GATE BILLING (à chaque chargement)
    app._index.tsx        # réglages swatches + titre dynamique + aperçu
    app.images.tsx        # réglages galerie + INSPECTEUR de groupes
    app.swatches.tsx      # bibliothèque valeur → couleur/image + import catalogue
    app.setup.tsx         # guide d'installation + deep link éditeur de thème
    proxy.settings.ts     # app proxy → config JSON storefront
    webhooks.*.tsx        # app/uninstalled, app/scopes_update
extensions/
  variant-engine/
    blocks/variant-engine.liquid   # rendu serveur des swatches + données produit + médias
    src/variantsy.js              # SOURCE storefront (galerie, titre, swatches)
    src/variantsy-collection.js   # SOURCE pastilles en page de collection
    assets/*.js                   # GÉNÉRÉS par npm run minify — jamais édités
    assets/variantsy.css          # styles storefront (reset boutons inclus)
    assets/variantsy-collection.css
    blocks/collection.liquid      # app embed : pastilles en collection
prisma/
  schema.prisma
  migrations/             # jouées par vercel-build ; filet manuel : npm run db:deploy
scripts/
  deploy.sh               # push + migration + extension, dans le bon ordre
  smoke-test.mjs          # tests storefront dans un vrai Chromium
  grouping-cases.json     # table de cas partagée admin ↔ storefront
  template-cases.json     # table de cas du moteur de titres
```

### Choix d'architecture à connaître

**Rendu serveur des swatches en Liquid.** Le HTML des swatches est produit par
le bloc Liquid, pas par le JS. Conséquences : pas de CLS, pas de flash du
sélecteur natif, et le contenu reste présent sans JavaScript. Le JS ne fait
qu'appliquer les couleurs et le comportement.

**Groupage des images par l'ordre des médias.** L'image assignée nativement à
une variante OUVRE son groupe ; les médias suivants le rejoignent jusqu'à la
prochaine image assignée. C'est ce qui rend l'app « sans configuration » : le
marchand range déjà ses photos dans cet ordre. Repli : le texte alternatif.
Garde-fou : si le groupage est incohérent (une seule valeur, aucune assignation,
option ambiguë), on ne filtre RIEN. Une galerie complète vaut mieux qu'une
galerie amputée à tort.

**Les médias sont masqués, jamais retirés du DOM.** Le zoom, la lightbox, les
vidéos et les modèles 3D du thème continuent de fonctionner sur les nœuds
d'origine, et l'affichage se rétablit instantanément.

**⚠️ DEUX DUPLICATIONS ASSUMÉES, chacune protégée par un test.** L'extension de
thème est un asset autonome servi par le CDN Shopify : elle ne peut rien
importer du bundle Remix. Deux moteurs existent donc en double :

| Moteur | Storefront | Admin | Table de cas |
|---|---|---|---|
| Groupage | `variantsy.js` (`computeGroups`) | `app/grouping.js` | `scripts/grouping-cases.json` |
| Templates de titre | `variantsy.js` (`renderTemplate`) | `app/shared.ts` | `scripts/template-cases.json` |

`npm run test` exécute **les deux implémentations sur les mêmes cas et compare
leurs sorties**. Si l'une dérive, le test casse. Sans ce garde-fou, l'aperçu et
l'inspecteur de l'admin mentiraient au marchand — le pire type de bug pour le
support. **Modifier l'un = modifier l'autre.**

**App proxy plutôt qu'endpoint public + CORS.** LiquidPop exposait un endpoint
JSON public avec CORS ouvert. Ici on passe par un app proxy :
même origine (pas de préflight OPTIONS), requête signée par Shopify (on connaît
la boutique de façon fiable), et la réponse passe par le CDN Shopify.

**Le sélecteur natif est piloté, jamais supprimé.** On le masque en CSS
seulement une fois Variantsy opérationnel, et on écrit systématiquement dans
`input[name="id"]` du formulaire d'ajout au panier. Même si le thème ignore nos
événements, le panier reçoit la bonne variante. Un bug côté swatches ne doit
jamais empêcher une vente.

---

## 8. Commandes

```bash
npm install                # dépendances
npm run minify             # génère extensions/*/assets depuis src/ (auto avant deploy)
npx playwright install chromium   # une seule fois, sinon `npm run test` échoue
npm run dev                # dev local via Shopify CLI (tunnel + HMR)
npm run typecheck          # tsc --noEmit
npm run test               # test de fumée du JS storefront dans Chromium
npm run db:deploy          # migrations sur la base pointée par .env
npm run deploy:extension   # déploie UNIQUEMENT l'extension de thème
npm run deploy:all         # push + migration + extension (ordre correct)
```

### Le test de fumée

`scripts/smoke-test.mjs` rejoue plusieurs pages produit façon Dawn (galerie,
miniatures, sélecteur natif, formulaire) dans un vrai Chromium et vérifie :

- l'ID de variante écrit dans le formulaire d'ajout au panier ;
- la synchronisation du sélecteur natif du thème ;
- le filtrage de la galerie ET des miniatures, y compris le cas piège d'un ID
  de média contenu en suffixe dans un autre (`123` vs `4123`) ;
- le repli sur le texte alternatif quand aucune image n'est assignée ;
- l'absence de filtrage sur un produit mal rangé ;
- le titre dynamique et ses blocs conditionnels ;
- le repli sur une variante valide quand la combinaison choisie n'existe pas ;
- le reset du chrome natif (piège n°5) ;
- **la concordance entre les moteurs admin et storefront** (voir plus haut).

**À lancer après toute modification de `variantsy.js` ou `variantsy.css`**, avant
`npm run deploy:extension`. Le déploiement d'extension n'a pas de rollback simple.

---

## 9. Checklist avant soumission App Store

- [ ] Gate de billing testé sur une boutique de dev **sans** abonnement →
      redirection vers `pricing_plans` visible au **2e** chargement aussi.
- [ ] Plan Managed Pricing **publié** (badge « App Pricing enabled »).
- [ ] Extension déployée (`npm run deploy:extension`) et bloc testé sur Dawn
      **et** sur au moins un thème premium.
- [ ] Migration jouée en prod (vérifier les logs de build Vercel).
- [ ] Testé sur un produit à 1 seule variante (le bloc ne doit rien afficher),
      un produit à 3 options, et un produit avec variantes en rupture.
- [ ] Galerie : testé sur un produit à 3 coloris × 4 photos, un produit sans
      aucune image assignée, et un produit contenant une vidéo.
- [ ] Inspecteur de groupes vérifié sur un vrai produit de la boutique de test.
- [ ] Zoom / lightbox / vidéo toujours fonctionnels après filtrage.
- [ ] Testé avec JavaScript désactivé : le sélecteur natif reste utilisable.
- [ ] Cibles tactiles ≥ 44 px, navigation clavier fonctionnelle, `aria-checked`
      correct sur les swatches.
- [ ] Désinstallation → réinstallation : les réglages sont retrouvés.
- [ ] Politique de confidentialité et coordonnées de support renseignées.
- [ ] Captures d'écran de la liste : avant/après sur une vraie page produit.

---

## 10. Évolutions identifiées (non implémentées)

- **Catalogue > 300 produits** : l'import de la bibliothèque est plafonné à 3
  pages de 100 produits. Passer par un `bulkOperationRunQuery` au-delà.
- **Overrides par produit** : aujourd'hui le mapping couleur est global à la
  boutique. Une table `ProductOverride` permettrait des exceptions.
- **Groupage par produit** : le groupage est aujourd'hui entièrement déduit.
  Une table `ProductGroupOverride` permettrait de corriger un produit atypique
  sans toucher aux médias.
- **Pages de collection** : ni Variant Image Automator ni Variantsy n'agissent
  sur les vignettes de collection. C'est la demande n°1 qui reviendra.
- **Polaris React est déprécié** : npm affiche un avertissement à l'install.
  La v13 reste fonctionnelle et largement utilisée, et l'admin actuel n'a aucune
  raison de bouger à court terme. À surveiller pour une V2 : Shopify pousse
  désormais les Polaris **web components**. Migration à planifier quand elle sera
  stable, pas dans l'urgence d'un avertissement npm.
- **Metafields en miroir** : mirrorer la config dans un metafield boutique
  permettrait au Liquid de la lire sans appel réseau (gain de ~100 ms), au prix
  d'une synchronisation supplémentaire à maintenir.
