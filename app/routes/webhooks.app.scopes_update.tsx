import type { ActionFunctionArgs } from "@remix-run/node";
import prisma, { withRetry } from "../db.server";
import { authenticate } from "../shopify.server";

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
  const { payload, session, topic, shop } = await lireWebhook(request);
  console.log(`[webhook] ${topic} — ${shop}`);

  const current = payload.current as string[];
  // updateMany plutôt que update : ce dernier LÈVE si la ligne a disparu —
  // une désinstallation concurrente suffit — et l'erreur remontait en 500.
  // withRetry couvre en plus la mise en veille de Neon.
  if (session) {
    await withRetry(() =>
      prisma.session.updateMany({
        where: { id: session.id },
        data: { scope: current.toString() },
      }),
    );
  }
  return new Response();
};
