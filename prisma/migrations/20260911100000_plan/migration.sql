-- Report du plan Shopify, pour que le storefront sache quoi servir.
-- "free" par défaut : une boutique dont on ne sait rien ne reçoit pas les
-- fonctionnalités payantes. Les boutiques déjà installées seront corrigées au
-- premier chargement de l'admin, qui relit le plan chez Shopify.
ALTER TABLE "ShopSettings" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';
