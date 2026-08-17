#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Variantsy — déploiement complet, dans le bon ordre.
#
# Existe pour une seule raison : sur l'app précédente, oublier l'une des trois
# étapes ci-dessous a coûté plusieurs heures de debug à chaque fois.
#
#   1. push        → Vercel redéploie l'admin Remix
#   2. migrate     → filet de sécurité, au cas où le build Vercel n'aurait pas
#                    joué la migration (piège n°2)
#   3. extension   → `shopify app deploy`, seule façon de déployer le storefront
#                    (piège n°1)
#
# Usage : npm run deploy:all  [-- "message de commit"]
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."

MESSAGE="${1:-chore: deploy}"
GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; RED=$'\033[0;31m'; NC=$'\033[0m'

step() { printf "\n%s▸ %s%s\n" "$GREEN" "$1" "$NC"; }
warn() { printf "%s!  %s%s\n" "$YELLOW" "$1" "$NC"; }
fail() { printf "%s✗  %s%s\n" "$RED" "$1" "$NC"; exit 1; }

[ -f .env ] || fail "Fichier .env introuvable. Copier .env.example et le remplir."

# --- Contrôles avant déploiement -------------------------------------------
step "Vérification des types"
npm run typecheck

# Le déploiement d'une extension n'a pas de rollback simple : on teste avant.
if git diff --name-only HEAD -- extensions/ | grep -q . || [ "${FORCE_TEST:-0}" = "1" ]; then
  step "Test de fumée du storefront"
  npm run test
fi

# --- 1. Admin Remix (via git push) ------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
  step "Commit et push (déploiement Vercel de l'admin)"
  git add -A
  git commit -m "$MESSAGE"
  git push
else
  warn "Aucun changement à committer — Vercel ne redéploiera pas."
fi

# --- 2. Migrations Prisma ---------------------------------------------------
# Le script vercel-build les joue déjà. On repasse derrière : c'est idempotent,
# ça coûte deux secondes, et ça évite le crash post-déploiement n°1 rencontré
# sur l'app précédente.
step "Application des migrations Prisma"
set -a; . ./.env; set +a
npx prisma migrate deploy

# --- 3. Extension de thème --------------------------------------------------
# ⚠️ Cette étape N'EST PAS couverte par le git push ci-dessus.
step "Déploiement de l'extension de thème"
npx shopify app deploy --force

printf "\n%s✓ Déploiement terminé.%s\n" "$GREEN" "$NC"
printf "  Admin      : redéployé par Vercel (vérifier les logs de build)\n"
printf "  Extension  : déployée via Shopify CLI\n"
printf "  Migrations : appliquées\n\n"
printf "%sRappel : vérifier dans les logs Vercel que 'prisma migrate deploy' est bien passé.%s\n" "$YELLOW" "$NC"
