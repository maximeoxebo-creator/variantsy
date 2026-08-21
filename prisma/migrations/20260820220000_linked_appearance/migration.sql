-- Réglages d'apparence et de titre propres aux produits liés.
--
-- Trois colonnes seulement, dont deux JSON : dupliquer les vingt-et-un
-- réglages de style en colonnes aurait condamné à une migration à chaque
-- nouveau réglage.
--
-- `linkedOverride` vaut false partout après cette migration : les boutiques
-- existantes continuent d'hériter des réglages communs, et aucun storefront
-- ne change tant que le marchand ne bascule pas l'interrupteur.
ALTER TABLE "ShopSettings"
  ADD COLUMN "linkedOverride" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "linkedStyle" JSONB,
  ADD COLUMN "linkedTitle" JSONB;
