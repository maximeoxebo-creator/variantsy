-- Typographie du libellé d'option.
--
-- Le libellé était figé à 0.875em — plus petit que le corps de texte — avec le
-- nom en maigre et la valeur en gras. Les thèmes font l'inverse : le nom est un
-- titre, la valeur un complément. Les défauts adoptent cette hiérarchie.
ALTER TABLE "ShopSettings"
  ADD COLUMN "labelSize" TEXT NOT NULL DEFAULT 'l',
  ADD COLUMN "labelNameBold" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ShopSettings" ALTER COLUMN "labelValueBold" SET DEFAULT false;
