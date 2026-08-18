-- Apparence des boutons texte et de la liste déroulante.
--
-- Les modes « boutons texte » et « liste déroulante » héritaient d'un arrondi
-- figé à 6 px et d'une largeur maximale de 320 px, sans aucun réglage : un
-- marchand qui les choisissait perdait toute maîtrise de leur aspect.
--
-- Les défauts reprennent les valeurs codées en dur jusqu'ici.
ALTER TABLE "ShopSettings" ADD COLUMN "controlRadius" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "ShopSettings" ADD COLUMN "dropdownFullWidth" BOOLEAN NOT NULL DEFAULT false;
