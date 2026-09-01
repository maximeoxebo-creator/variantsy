import type { ActionFunctionArgs } from "@remix-run/node";
import prisma, { withRetry } from "../db.server";
import { authenticate } from "../shopify.server";

/**
 * Webhooks de conformité obligatoires pour toute app publiée sur l'App Store.
 *
 * Les trois topics arrivent sur une seule route, comme le montre l'exemple de
 * la documentation : ils partagent la même vérification de signature et le même
 * contrat de réponse.
 *
 * DEUX RÈGLES QUE L'EXAMEN SHOPIFY TESTE EXPLICITEMENT :
 *   1. signature valide   → statut 2xx
 *   2. signature INVALIDE → statut 401
 *
 * La seconde est celle qu'on rate : un handler qui attrape toutes les erreurs
 * pour « ne jamais planter » répond 200 à une requête non signée, et l'app est
 * refusée. `authenticate.webhook` lève une Response 401 ; on la laisse donc
 * remonter telle quelle, sans try/catch autour.
 *
 * Ce que l'app détient réellement : des réglages de boutique et une
 * bibliothèque de couleurs. AUCUNE donnée personnelle de client — ni nom, ni
 * e-mail, ni commande. Les deux topics « customers » n'ont donc rien à purger
 * ni à restituer, et c'est une réponse légitime : le règlement demande de
 * traiter la demande, pas d'inventer des données.
 */
/**
 * Lit l'enveloppe du webhook sans se laisser abattre par une session morte.
 *
 * `authenticate.webhook` charge la session de la boutique, et avec des jetons
 * EXPIRANTS il tente de la rafraîchir. Or une désinstallation révoque
 * justement ce jeton : le rafraîchissement échoue, l'erreur remonte, et
 * Shopify reçoit un 500 sur l'accusé de réception. Le webhook le plus
 * important de tous échouait donc par construction, et Shopify le relançait
 * en boucle — d'où un taux d'échec qui ne pouvait pas redescendre.
 *
 * On rattrape donc tout SAUF une Response : celle-ci porte le 401 des
 * signatures invalides, que l'examen Shopify teste explicitement et qui doit
 * remonter intact. La vérification HMAC a lieu AVANT le chargement de la
 * session, elle n'est donc jamais court-circuitée.
 */
async function lireWebhook(request: Request) {
  try {
    return await authenticate.webhook(request);
  } catch (error) {
    // La librairie enveloppe SES échecs dans une Response, y compris celui du
    // rafraîchissement de jeton — un 500 qu'on ne peut pas laisser passer.
    // On ne relaie donc que les réponses CLIENT : le 401 des signatures
    // invalides, que l'examen teste, et le 400 des requêtes malformées.
    if (error instanceof Response && error.status < 500) throw error;
    console.error("[webhook] session illisible, on accuse quand même réception", error);
    // Repli minimal, tiré des seuls en-têtes : le contexte complet de la
    // librairie n'existe pas ici, et le peu qu'on en garde suffit à nettoyer.
    return {
      shop: request.headers.get("X-Shopify-Shop-Domain") ?? "",
      topic: request.headers.get("X-Shopify-Topic") ?? "",
      session: undefined,
      payload: undefined,
    } as unknown as Awaited<ReturnType<typeof authenticate.webhook>>;
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await lireWebhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // Rien à restituer : aucune donnée client n'est stockée. On journalise
      // pour pouvoir en attester si le marchand ou Shopify le demande.
      console.log(`[conformité] demande de données client — ${shop} — aucune donnée détenue`);
      break;

    case "CUSTOMERS_REDACT":
      console.log(`[conformité] effacement client — ${shop} — aucune donnée détenue`);
      break;

    case "SHOP_REDACT": {
      // Là, il y a vraiment quelque chose à effacer. Shopify envoie ce topic
      // 48 h après une désinstallation, et tout ce qui concerne la boutique
      // doit disparaître.
      //
      // C'est le pendant de `app/uninstalled`, qui CONSERVE volontairement les
      // réglages pour qu'un marchand qui réinstalle retrouve sa configuration.
      // Cette rétention est légitime à court terme ; elle cesse de l'être quand
      // le marchand demande l'effacement. Ici on purge donc tout.
      // Les groupes de produits liés manquaient à cet effacement : ils sont
      // arrivés après l'écriture de ce webhook, et une ligne par groupe
      // survivait donc à une demande de suppression. Ils portent le domaine de
      // la boutique, donc ils relèvent du même devoir d'effacement.
      const [reglages, couleurs, groupes, sessions] = await withRetry(() =>
        prisma.$transaction([
          prisma.shopSettings.deleteMany({ where: { shop } }),
          prisma.swatchValue.deleteMany({ where: { shop } }),
          prisma.productGroup.deleteMany({ where: { shop } }),
          prisma.session.deleteMany({ where: { shop } }),
        ]),
      );
      console.log(
        `[conformité] effacement boutique — ${shop} — ` +
          `${reglages.count} réglage(s), ${couleurs.count} couleur(s), ` +
          `${groupes.count} groupe(s), ${sessions.count} session(s)`,
      );
      break;
    }

    default:
      // Un topic inattendu sur cette route ne doit pas produire d'erreur : la
      // signature était valide, donc la requête vient bien de Shopify.
      console.log(`[conformité] topic non traité : ${topic} — ${shop}`, payload ? "" : "");
  }

  return new Response();
};
