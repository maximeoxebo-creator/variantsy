import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { enregistrerPlan } from "../settings.server";
import { publierStyle } from "../publier-style.server";

/**
 * Un abonnement change d'état : on le reporte en base sans attendre.
 *
 * POURQUOI CE WEBHOOK EXISTE. Le plan est relu chez Shopify à chaque ouverture
 * de l'admin — mais un marchand qui résilie n'a aucune raison d'ouvrir l'app
 * ensuite. Sans ce webhook, sa boutique garderait la galerie par couleur
 * indéfiniment : le storefront lit le plan reporté en base, et rien ne
 * viendrait jamais le corriger.
 *
 * Les statuts qui ne valent PAS un abonnement vivant — ACTIVE mis à part —
 * ramènent au gratuit. `EXPIRED`, `CANCELLED`, `DECLINED`, `FROZEN` : aucun ne
 * donne droit aux fonctionnalités payantes.
 *
 * Volontairement tolérant : un webhook qu'on ne sait pas lire est ACQUITTÉ
 * quand même. Shopify compte les échecs, et le prochain chargement de l'admin
 * corrigera de toute façon.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  let shop = "";
  let statut = "";
  let admin: Parameters<typeof publierStyle>[0] | undefined;
  try {
    const { payload, shop: boutique, topic, admin: client } = await authenticate.webhook(request);
    shop = boutique;
    admin = client as typeof admin;
    console.log(`[webhook] ${topic} — ${shop}`);
    const abonnement = (payload as { app_subscription?: { status?: string } }).app_subscription;
    statut = String(abonnement?.status ?? "").toUpperCase();
  } catch (error) {
    // Seules les réponses CLIENT remontent : le 401 des signatures invalides,
    // que l'examen Shopify teste explicitement. Voir webhooks.app.scopes_update.
    if (error instanceof Response && error.status < 500) throw error;
    console.error("[webhook] abonnement illisible, on accuse quand même réception", error);
    return new Response();
  }

  if (!shop || !statut) return new Response();

  const change = await enregistrerPlan(shop, statut === "ACTIVE" ? "pro" : "free");

  // La base seule ne suffit pas. La rangée des fiches sœurs est rendue par le
  // bloc LIQUID, qui lit une métadonnée de boutique : sans republication, une
  // résiliation laisserait cette rangée en place indéfiniment, et un
  // abonnement ne la ferait pas réapparaître avant la prochaine ouverture de
  // l'admin. Un échec ici n'empêche pas d'accuser réception : le prochain
  // chargement de l'admin republiera.
  if (change && admin) {
    try {
      await publierStyle(admin, shop);
    } catch (error) {
      console.error("[webhook] republication du style impossible", error);
    }
  }
  return new Response();
};
