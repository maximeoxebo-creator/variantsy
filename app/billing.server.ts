/**
 * Type minimal du client Admin dont on a besoin.
 * On ne réutilise pas `AdminApiContext` de la lib : avec `removeRest: true`
 * (voir shopify.server.ts) le contexte n'a plus de propriété `rest`, et le
 * type exporté par défaut, lui, l'exige toujours. Un type structurel évite
 * cette friction sans rien perdre en sécurité.
 */
type GraphqlAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

/**
 * PIÈGE N°4 — Billing invisible pour le reviewer (rejet App Store réf. 125316,
 * règle 1.2.1). Voir CLAUDE.md.
 *
 * Erreur commise sur LiquidPop : la redirection vers la page de pricing ne se
 * déclenchait qu'à la PREMIÈRE visite (test basé sur l'absence d'une ligne en
 * base). Dès la 2e visite, le reviewer ne voyait plus jamais la page de
 * facturation → rejet.
 *
 * Règle ici : le gate tourne sur CHAQUE chargement de l'app, et interroge
 * Shopify (pas notre base) pour savoir si un abonnement est actif. Aucun état
 * local ne peut désynchroniser le gate de la réalité.
 *
 * Note importante : Shopify marque les abonnements en période d'essai comme
 * `ACTIVE`. Tester "le tableau activeSubscriptions n'est pas vide" couvre donc
 * à la fois l'essai gratuit et l'abonnement payant. Pas besoin de logique
 * spécifique au trial.
 */

const ACTIVE_SUBS_QUERY = `#graphql
  query VariantsyActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        trialDays
        createdAt
        currentPeriodEnd
      }
    }
  }
`;

export type ActiveSubscription = {
  id: string;
  name: string;
  status: string;
  trialDays: number;
  createdAt: string;
  currentPeriodEnd: string | null;
};

export async function getActiveSubscriptions(
  admin: GraphqlAdmin,
): Promise<ActiveSubscription[]> {
  const response = await admin.graphql(ACTIVE_SUBS_QUERY);
  const body = (await response.json()) as {
    data?: { currentAppInstallation?: { activeSubscriptions?: ActiveSubscription[] } };
  };
  return body?.data?.currentAppInstallation?.activeSubscriptions ?? [];
}

/**
 * Construit l'URL de la page Managed Pricing.
 * `shop` arrive sous la forme "ma-boutique.myshopify.com" ; l'URL admin attend
 * juste le handle "ma-boutique".
 */
export function pricingPlansUrl(shop: string): string {
  const shopHandle = shop.replace(/\.myshopify\.com$/, "");
  const appHandle = process.env.SHOPIFY_APP_HANDLE || "variantsy";
  return `https://admin.shopify.com/store/${shopHandle}/charges/${appHandle}/pricing_plans`;
}

/**
 * À appeler dans le loader du layout racine `app.tsx`.
 * Lève une redirection top-level si aucun abonnement (ni essai) n'est actif.
 *
 * `target: "_top"` est obligatoire : sans lui, la page de pricing s'ouvrirait
 * dans l'iframe embarquée et Shopify la refuserait (X-Frame-Options).
 */
export async function requireActivePlan(
  admin: GraphqlAdmin,
  shop: string,
  redirect: (url: string, init?: { target?: string }) => never,
): Promise<ActiveSubscription[]> {
  let subscriptions: ActiveSubscription[] = [];
  try {
    subscriptions = await getActiveSubscriptions(admin);
  } catch (error) {
    // Si l'appel GraphQL échoue (réseau, throttling), on NE bloque pas le
    // marchand : mieux vaut laisser passer une session que d'afficher une
    // erreur. Le gate se réappliquera au prochain chargement.
    console.error("[billing] impossible de vérifier l'abonnement", error);
    return [];
  }

  if (subscriptions.length === 0) {
    throw redirect(pricingPlansUrl(shop), { target: "_top" });
  }
  return subscriptions;
}
