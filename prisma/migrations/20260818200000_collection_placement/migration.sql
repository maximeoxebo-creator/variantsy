-- Placement des pastilles sur une vignette de collection.
--
-- Sous le bloc de texte, elles allongent la carte et se noient dans le reste.
-- En surimpression sur la photo — le placement retenu par la plupart des apps
-- de ce marché — elles se voient immédiatement et ne déplacent rien.
ALTER TABLE "ShopSettings" ADD COLUMN "collectionPlacement" TEXT NOT NULL DEFAULT 'overlay';
