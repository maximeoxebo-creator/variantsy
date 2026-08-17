# Variantsy

Plusieurs images par variante + titre produit dynamique + swatches, pour Shopify.

> **Avant de coder ou de déployer, lire [`CLAUDE.md`](./CLAUDE.md).** Il
> documente les deux pipelines de déploiement et cinq pièges qui ont coûté cher
> sur l'app précédente.

---

## Démarrage

```bash
npm install
cp .env.example .env          # puis remplir les valeurs
npx shopify app config link   # relie le dépôt à l'app du Partner Dashboard
npm run db:deploy             # crée les tables sur Neon
npm run dev
```

## Fonctionnalités

- **Plusieurs images par variante** — Shopify n'en autorise qu'une. Variantsy
  regroupe les médias d'après leur ordre dans l'admin (l'image assignée à une
  variante ouvre son groupe, les suivantes le rejoignent) et filtre la galerie
  du thème, miniatures comprises. Aucune configuration produit par produit.
- **Repli sur le texte alternatif** pour les catalogues importés automatiquement
- **Inspecteur de groupes** dans l'admin : voir, produit par produit, quelles
  images iront à quel coloris
- **Swatches couleur, bicolores ou image**, forme et taille réglables
- **Titre produit dynamique** piloté par un template
  (`{{product_title}}`, `{{variant_title}}`, `{{option:Couleur}}`, `{{sku}}`,
  `{{vendor}}`…) avec **blocs conditionnels** `[[ … ]]` pour éviter les
  séparateurs orphelins
- **Gestion des ruptures** : barré, atténué ou masqué
- **Import automatique du catalogue** avec reconnaissance des noms de couleurs
  FR/EN (≈150 teintes)
- **Aperçu en direct** dans l'admin
- **Compatible thèmes** : le sélecteur natif est piloté, pas remplacé — le
  panier reçoit toujours la bonne variante

## Architecture en une minute

| Couche | Techno | Déploiement |
|---|---|---|
| Admin | Remix + Polaris + App Bridge | Vercel, via `git push` |
| Base | PostgreSQL Neon + Prisma | migrations dans `vercel-build` |
| Storefront | Theme app extension (Liquid + JS vanilla) | `npm run deploy:extension` |
| Config storefront | App proxy `/apps/variantsy/settings` | — |

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Dev local (tunnel Shopify CLI) |
| `npm run typecheck` | Vérification TypeScript |
| `npm run test` | Test de fumée du JS storefront (Chromium) |
| `npm run db:deploy` | Migrations Prisma sur la base de `.env` |
| `npm run deploy:extension` | Déploie **uniquement** l'extension de thème |
| `npm run deploy:all` | Push + migrations + extension, dans le bon ordre |

## Variables d'environnement

Voir [`.env.example`](./.env.example). Les mêmes doivent être renseignées dans
Vercel → Settings → Environment Variables.

## Licence

Propriétaire — Helmut Agency.
