-- Graisse de la valeur dans le libellé « Couleur : Bleu marine ».
-- true reproduit le comportement d'avant : aucune boutique ne change.
ALTER TABLE "ShopSettings"
  ADD COLUMN "labelValueBold" BOOLEAN NOT NULL DEFAULT true;
