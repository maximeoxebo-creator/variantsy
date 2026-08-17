import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",

  /**
   * PIÈGE N°3 — Neon scale-to-zero (voir CLAUDE.md).
   *
   * PrismaSessionStorage teste la présence de la table Session au démarrage
   * (`pollForTable`) et MET LE RÉSULTAT EN CACHE pour toute la durée de vie de
   * l'instance serverless. Si ce test tombe pendant un cold-start Neon, l'échec
   * reste figé : toutes les requêtes suivantes sur cette instance Vercel
   * plantent avec `MissingSessionTableError` alors que la table existe.
   *
   * D'où ces retries volontairement généreux : 5 × 3 s = ~15 s de marge,
   * contre 2 × 5 s par défaut. Un cold-start Neon mesuré prend 1-3 s ; 15 s
   * couvre même un pic de charge côté Neon.
   *
   * NE PAS BAISSER CES VALEURS pour "accélérer le démarrage" : elles ne
   * coûtent rien quand la base répond, elles ne servent que dans le pire cas.
   */
  sessionStorage: new PrismaSessionStorage(prisma, {
    connectionRetries: 5,
    connectionRetryIntervalMs: 3000,
  }),

  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
