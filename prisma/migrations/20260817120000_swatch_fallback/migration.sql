-- Repli des pastilles sans couleur associée.
--
-- Jusqu'ici, une valeur absente de la bibliothèque affichait la photo de sa
-- variante. Sur un catalogue où toutes les photos se ressemblent — des cocottes
-- en fonte, par exemple — le marchand obtient une rangée de vignettes
-- indiscernables au lieu d'un nuancier.
--
-- "image" reste le défaut : aucune boutique existante ne change d'apparence.
ALTER TABLE "ShopSettings" ADD COLUMN "swatchFallback" TEXT NOT NULL DEFAULT 'image';
ALTER TABLE "ShopSettings" ADD COLUMN "neutralColor" TEXT NOT NULL DEFAULT '#ECECEC';
