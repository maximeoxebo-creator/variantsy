-- Mode d'affichage des options NON colorées.
--
-- « text » reproduit exactement le comportement d'avant cette colonne : les
-- boutiques existantes ne voient donc rien changer.
ALTER TABLE "ShopSettings"
  ADD COLUMN "otherDisplayMode" TEXT NOT NULL DEFAULT 'text';
