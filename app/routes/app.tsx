import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { requireActivePlan } from "../billing.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, redirect } = await authenticate.admin(request);

  // ---------------------------------------------------------------------
  // GATE DE FACTURATION — bloquant, sur CHAQUE chargement de l'app.
  //
  // Placé ici (layout racine) et pas dans une route enfant : toutes les pages
  // de l'app passent par ce loader, donc aucune ne peut être atteinte sans
  // abonnement actif. C'est exactement ce que le reviewer Shopify vérifie
  // (règle 1.2.1). Voir app/billing.server.ts pour le détail du rejet évité.
  //
  // ⚠️ Ne jamais transformer ce gate en "seulement à la première visite".
  // ---------------------------------------------------------------------
  const subscriptions = await requireActivePlan(admin, session.shop, redirect as never);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
    planName: subscriptions[0]?.name ?? null,
  };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Réglages
        </Link>
        <Link to="/app/images">Images par variante</Link>
        <Link to="/app/swatches">Bibliothèque de swatches</Link>
        <Link to="/app/setup">Installation</Link>
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
