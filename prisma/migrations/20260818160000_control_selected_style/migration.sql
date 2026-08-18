-- Aspect de la case choisie en modes « boutons texte » et « liste déroulante ».
--
-- La sélection s'y signalait par un liseré, sans alternative. Un fond plein est
-- plus lisible sur un nuancier dense, et c'est ce que font la plupart des
-- sélecteurs de taille.
--
-- "outline" reste le défaut : aucune boutique existante ne change d'apparence.
ALTER TABLE "ShopSettings" ADD COLUMN "controlSelectedStyle" TEXT NOT NULL DEFAULT 'outline';
