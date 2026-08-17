import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  DEFAULT_SETTINGS,
  getSettings,
  listSwatchValues,
  toStorefrontConfig,
} from "../settings.server";

/**
 * Endpoint consommé par l'extension de thème.
 * URL côté boutique : https://<boutique>/apps/variantsy/settings
 *
 * Pourquoi un app proxy plutôt qu'un endpoint public + CORS (approche
 * LiquidPop) :
 *  - même origine → zéro préflight OPTIONS, une requête au lieu de deux
 *  - Shopify signe la requête (HMAC) → on connaît la boutique de façon fiable,
 *    sans paramètre `?shop=` falsifiable
 *  - la réponse passe par le CDN Shopify, qui respecte notre Cache-Control
 *
 * ⚠️ RÈGLE ABSOLUE : cette route ne doit JAMAIS renvoyer une erreur 5xx.
 * Elle s'exécute sur chaque page produit de la boutique. Si la base est
 * endormie (Neon scale-to-zero, piège n°3), on renvoie les valeurs par défaut
 * avec un cache court plutôt qu'une erreur : les swatches s'affichent au style
 * par défaut au lieu de disparaître.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  let shop: string | null = null;

  try {
    const { session, liquid: _liquid } = await authenticate.public.appProxy(request);
    shop = session?.shop ?? new URL(request.url).searchParams.get("shop");
  } catch (error) {
    console.error("[proxy] signature invalide", error);
    return json(
      { v: 1, enabled: false, error: "unauthorized" },
      { status: 401, cache: "no-store" },
    );
  }

  if (!shop) {
    return json({ v: 1, enabled: false, error: "no_shop" }, { status: 200, cache: "no-store" });
  }

  try {
    const [settings, values] = await Promise.all([getSettings(shop), listSwatchValues(shop)]);
    return json(toStorefrontConfig(settings, values), { status: 200, cache: "cdn" });
  } catch (error) {
    console.error("[proxy] base injoignable, repli sur les valeurs par défaut", error);
    return json(toStorefrontConfig(DEFAULT_SETTINGS, []), {
      status: 200,
      // Cache très court : dès que la base répond, on veut la vraie config.
      cache: "short",
    });
  }
};

function json(
  data: unknown,
  { status, cache }: { status: number; cache: "cdn" | "short" | "no-store" },
) {
  const cacheControl =
    cache === "cdn"
      ? "public, max-age=0, s-maxage=60, stale-while-revalidate=600"
      : cache === "short"
        ? "public, max-age=0, s-maxage=10"
        : "no-store";

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
    },
  });
}
