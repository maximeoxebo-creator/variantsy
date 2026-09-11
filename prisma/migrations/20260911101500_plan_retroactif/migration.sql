-- Les boutiques déjà installées l'ont été sous un régime où le SEUL plan était
-- payant : l'ancien gate exigeait un abonnement actif — essai compris — avant
-- de laisser entrer. Les laisser à "free" leur retirerait, le temps d'un
-- chargement d'admin, la galerie par couleur qu'elles paient.
--
-- Une boutique qui aurait rebondi sur le gate sans jamais s'abonner sera
-- corrigée d'elle-même : le plan est relu chez Shopify à chaque ouverture de
-- l'app, et reporté ici.
UPDATE "ShopSettings" SET "plan" = 'pro';
