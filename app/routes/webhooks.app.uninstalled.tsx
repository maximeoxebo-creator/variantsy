import type { ActionFunctionArgs } from "@remix-run/node";
import prisma, { withRetry } from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`[webhook] ${topic} — ${shop}`);

  // Une désinstallation invalide toutes les sessions. On les purge, mais on
  // GARDE les réglages (ShopSettings / SwatchValue) : si le marchand
  // réinstalle dans les jours qui suivent, il retrouve sa configuration.
  // C'est un vrai gain de rétention, et c'est conforme (pas de donnée client).
  // withRetry est indispensable ici : Neon met sa base en veille, et le
  // premier appel après une période creuse échoue de façon transitoire. Sans
  // reprise, Shopify recevait un 500 et comptait une livraison en échec — un
  // taux d'échec élevé nuit à l'examen comme à la santé de l'app.
  if (session) {
    await withRetry(() => prisma.session.deleteMany({ where: { shop } }));
  }

  return new Response();
};
