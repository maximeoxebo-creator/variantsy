-- Agrandissement des pastilles qui affichent une photo.
--
-- Une photo de produit réduite à 40 px n'est pas reconnaissable, là où un aplat
-- de couleur l'est parfaitement. Les marchands qui choisissent « la photo du
-- produit » comme repli avaient donc le choix entre des pastilles illisibles et
-- agrandir TOUTES leurs pastilles, y compris celles de couleur unie.
--
-- 100 % laisse le comportement inchangé.
ALTER TABLE "ShopSettings" ADD COLUMN "photoScale" INTEGER NOT NULL DEFAULT 100;
