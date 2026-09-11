import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { planActuel } from "../billing.server";
import { enregistrerPlan, getSettings } from "../settings.server";
import { publierStyle } from "../publier-style.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // ---------------------------------------------------------------------
  // PLAN — relu chez SHOPIFY sur CHAQUE chargement de l'app.
  //
  // Placé ici (layout racine) et pas dans une route enfant : toutes les pages
  // passent par ce loader, donc aucune ne peut afficher un plan périmé.
  //
  // ⚠️ Ne jamais le lire depuis notre base : c'est l'erreur qui avait valu un
  // rejet sur LiquidPop (règle 1.2.1). La base ne fait que REPORTER ce que
  // Shopify vient de dire, pour le storefront qui n'a pas de session admin.
  //
  // Depuis le forfait gratuit, ce plan ne bloque plus l'entrée : il décide de
  // ce qui est déverrouillé. Voir app/billing.server.ts.
  // ---------------------------------------------------------------------
  const { plan, pricingUrl } = await planActuel(admin, session.shop);
  // Un changement de plan doit atteindre le STOREFRONT tout de suite : la
  // rangée de produits liés est rendue par le bloc Liquid, qui lit une
  // métadonnée de boutique. Sans cette republication, un marchand qui vient de
  // s'abonner ne la verrait revenir qu'à son prochain enregistrement de
  // réglages.
  if (await enregistrerPlan(session.shop, plan)) {
    await publierStyle(admin, session.shop);
  }
  const settings = await getSettings(session.shop);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
    // `plan` vaut null quand Shopify n'a pas répondu : on affiche alors ce
    // qu'on avait enregistré, plutôt que de rétrograder le marchand à l'écran.
    plan: plan ?? settings.plan,
    pricingUrl,
  };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      {/* Installation, apparence, galerie et titre vivent désormais dans les
          onglets d'une page unique. Ne restent au menu que les deux OUTILS :
          une table de données et un inspecteur, qui ne se logent pas dans un
          onglet de réglages sans devenir illisibles. */}
      {/* La bibliothèque de teintes est le SEUL endroit qui permette d'habiller
          une option autre que la couleur — matière, finition, motif : elle est
          indexée par nom d'option ET valeur, et accepte une image. Le
          storefront le sait déjà (voir looksLikeColorOption), mais l'écran
          n'était joignable que par son URL. Un réglage qu'on ne trouve pas
          n'existe pas. */}
      <NavMenu>
        <Link to="/app" rel="home">
          Variantsy
        </Link>
        <Link to="/app/swatches">Color library</Link>
        <Link to="/app/images">Inspect a product</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Obligatoire : renvoie les erreurs dans le format attendu par App Bridge
// (sinon une erreur serveur affiche une page blanche dans l'iframe admin).
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
