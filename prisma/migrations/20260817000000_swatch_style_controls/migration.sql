-- Réglages de style des swatches qui manquaient.
--
-- L'anneau de sélection et la bordure épaisse étaient écrits en dur à 2 px dans
-- variantsy.css : aucun marchand ne pouvait les affiner. Le rayon des coins du
-- mode "carré arrondi" était figé à 8 px pour la même raison.
--
-- Les défauts reprennent exactement les valeurs codées en dur jusqu'ici, donc
-- l'apparence des boutiques existantes ne bouge pas d'un pixel.
ALTER TABLE "ShopSettings" ADD COLUMN "selectedWidth" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "ShopSettings" ADD COLUMN "selectedGap" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "ShopSettings" ADD COLUMN "cornerRadius" INTEGER NOT NULL DEFAULT 8;
