-- Pastilles tirées des fichiers de la boutique, par correspondance de nom.
-- Désactivé par défaut : c'est une convention, pas un comportement attendu.
ALTER TABLE "ShopSettings"
  ADD COLUMN "swatchFileMatch" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "swatchFileExt" TEXT NOT NULL DEFAULT 'png';
