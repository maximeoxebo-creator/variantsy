import type { ActionFunctionArgs } from "@remix-run/node";
import prisma, { withRetry } from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
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
