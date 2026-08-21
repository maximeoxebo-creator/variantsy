import { getSettings, listSwatchValues, toStorefrontConfig } from "./settings.server";
import { stylePublie } from "./style-css.server";

/* ==========================================================================
   Publication de l'apparence dans une métadonnée de BOUTIQUE.

   Le bloc Liquid la lit pour habiller les pastilles dès le premier rendu, sans
   attendre l'app proxy. C'est ce qui supprime le saut de mise en page : le
   bloc écrivait jusqu'ici les valeurs d'usine, remplacées ensuite par celles
   du marchand.

   Publiée à chaque enregistrement des réglages. Si l'appel échoue — jeton
   expiré, API indisponible — on n'échoue PAS l'enregistrement : les réglages
   sont déjà en base, le storefront les obtiendra par l'app proxy comme avant,
   et la prochaine sauvegarde republiera.
   ========================================================================== */

type GraphqlAdmin = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

const SHOP_ID = `#graphql
  query VariantsyShopId { shop { id } }
`;

const SET = `#graphql
  mutation VariantsyPublishStyle($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;

export async function publierStyle(admin: GraphqlAdmin, shop: string): Promise<void> {
  try {
    const [reglages, valeurs] = await Promise.all([getSettings(shop), listSwatchValues(shop)]);
    const charge = stylePublie(toStorefrontConfig(reglages, valeurs));

    const idResponse = await admin.graphql(SHOP_ID);
    const idBody = (await idResponse.json()) as { data?: { shop?: { id: string } } };
    const ownerId = idBody?.data?.shop?.id;
    if (!ownerId) return;

    await admin.graphql(SET, {
      variables: {
        metafields: [
          {
            ownerId,
            namespace: "variantsy",
            key: "style",
            type: "json",
            value: JSON.stringify(charge),
          },
        ],
      },
    });
  } catch (error) {
    console.error("[variantsy] publication du style impossible", error);
  }
}
