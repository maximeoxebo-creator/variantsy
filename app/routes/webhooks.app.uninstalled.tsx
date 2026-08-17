import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`[webhook] ${topic} — ${shop}`);

  // Une désinstallation invalide toutes les sessions. On les purge, mais on
  // GARDE les réglages (ShopSettings / SwatchValue) : si le marchand
  // réinstalle dans les jours qui suivent, il retrouve sa configuration.
  // C'est un vrai gain de rétention, et c'est conforme (pas de donnée client).
  if (session) {
    await prisma.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
