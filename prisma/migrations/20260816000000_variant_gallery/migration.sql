-- Galerie multi-images par variante + enrichissement du titre dynamique.
-- Migration purement additive : toutes les colonnes ont une valeur par défaut,
-- donc les lignes existantes restent valides et le déploiement peut se faire
-- sans fenêtre de maintenance.

ALTER TABLE "ShopSettings"
  ADD COLUMN "galleryEnabled"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "groupBy"             TEXT    NOT NULL DEFAULT 'auto',
  ADD COLUMN "commonMediaMode"     TEXT    NOT NULL DEFAULT 'append',
  ADD COLUMN "altFallback"         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "altPrefix"           TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "thumbSelectorCss"    TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "skipSingleGroup"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "updateDocumentTitle" BOOLEAN NOT NULL DEFAULT false;
