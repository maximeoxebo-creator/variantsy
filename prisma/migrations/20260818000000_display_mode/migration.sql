-- Mode d'affichage des options de couleur.
--
-- Jusqu'ici, une option reconnue comme couleur s'affichait forcément en
-- pastilles. Certains marchands préfèrent des boutons texte — nuancier trop
-- large, teintes indiscernables — ou une liste déroulante sur un catalogue à
-- nombreuses valeurs.
--
-- "swatch" reste le défaut : aucune boutique existante ne change d'apparence.
ALTER TABLE "ShopSettings" ADD COLUMN "displayMode" TEXT NOT NULL DEFAULT 'swatch';
