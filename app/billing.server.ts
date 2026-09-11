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
 * Règle ici : le plan est relu depuis SHOPIFY à chaque chargement de l'app,
 * jamais depuis notre base. Aucun état local ne peut le désynchroniser de la
 * réalité. Ce qu'on enregistre ensuite en base n'est qu'un report, pour que le
 * storefront — qui n'a pas de session admin — sache quoi servir.
 *
 * Depuis l'ajout du forfait gratuit, ce plan ne BLOQUE plus l'entrée : il
 * décide de ce qui est déverrouillé. Voir planActuel plus bas pour la raison,
 * qui tient à une particularité de Shopify App Pricing.
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

export type Plan = "free" | "pro";

/**
 * Le plan du marchand, tel que Shopify le connaît.
 *
 * POURQUOI PAS DE REDIRECTION — et c'est un renversement par rapport à la
 * version precedente de ce fichier.
 *
 * Un forfait GRATUIT de Shopify App Pricing ne cree aucun abonnement :
 * `activeSubscriptions` revient vide, exactement comme pour un marchand qui
 * n'aurait rien choisi. Les deux cas sont indiscernables depuis l'API Admin.
 * L'ancien gate redirigeait sur tableau vide : garde tel quel, il aurait
 * enferme toute boutique en gratuit dans une boucle vers la page de
 * tarification.
 *
 * Tableau vide vaut donc GRATUIT, et l'app s'ouvre. La regle 1.2.1 reste
 * satisfaite autrement : les fonctionnalites payantes sont verrouillees et la
 * page de tarification est joignable d'un clic depuis l'admin — c'est ce que
 * le reviewer doit pouvoir constater.
 *
 * Un essai en cours compte comme PRO : Shopify marque les abonnements en
 * periode d'essai `ACTIVE`.
 */
export async function planActuel(
  admin: GraphqlAdmin,
  shop: string,
): Promise<{ plan: Plan | null; subscriptions: ActiveSubscription[]; pricingUrl: string }> {
  let subscriptions: ActiveSubscription[] = [];
  try {
    subscriptions = await getActiveSubscriptions(admin);
  } catch (error) {
    // Un appel qui echoue (reseau, throttling) ne doit jamais degrader un
    // marchand payant : on le laisse sur le plan qu'on lui connait deja, et
    // l'appelant gardera la valeur enregistree.
    console.error("[billing] impossible de vérifier l'abonnement", error);
    // `null` ne veut pas dire gratuit : il veut dire « je ne sais pas ». Rendre
    // « gratuit » ici retirerait ses fonctionnalites a un marchand payant sur
    // un simple hoquet reseau.
    return { plan: null, subscriptions: [], pricingUrl: pricingPlansUrl(shop) };
  }

  return {
    plan: subscriptions.length > 0 ? "pro" : "free",
    subscriptions,
    pricingUrl: pricingPlansUrl(shop),
  };
}
