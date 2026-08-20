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
  apiVersion: ApiVersion.July26,
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
  /**
   * `expiringOfflineAccessTokens` n'est pas une option de confort : depuis 2025,
   * Shopify répond 403 à TOUTE requête Admin faite avec un jeton perpétuel
   * (« Non-expiring access tokens are no longer accepted »). Sans ce drapeau,
   * l'app obtient un jeton du vieux type et son back-office est mort — plus
   * d'inspecteur, plus d'import, plus de lien vers l'éditeur de thème.
   *
   * L'accès ne vaut plus qu'une heure. La librairie le renouvelle seule grâce
   * au jeton de rafraîchissement stocké en base (colonnes `refreshToken` et
   * `refreshTokenExpires`), valable 90 jours.
   *
   * `removeRest` a bien disparu en v4 : l'API REST a été retirée pour de bon,
   * il n'y a plus rien à désactiver.
   *
   * `unstable_newEmbeddedAuthStrategy`, EN REVANCHE, EXISTE TOUJOURS en 4.2.1
   * — un commentaire précédent affirmait le contraire, à tort. Sans lui,
   * `shopifyApp()` instancie `AuthCodeFlowStrategy` et non
   * `TokenExchangeStrategy` (voir le branchement dans shopify-app.js), et
   * `login()` renvoie vers /auth au lieu du chemin d'installation gérée. La
   * librairie le signale à chaque démarrage :
   *   « Future flag unstable_newEmbeddedAuthStrategy is disabled. »
   *
   * Les conditions sont réunies — `embedded = true` et les scopes déclarés
   * dans shopify.app.toml sans `use_legacy_install_flow`, c'est-à-dire
   * l'installation gérée par Shopify — donc il est activé. L'app échange
   * désormais le jeton de session d'App Bridge contre un jeton d'accès, sans
   * le détour par la redirection OAuth.
   */
  future: {
    expiringOfflineAccessTokens: true,
    unstable_newEmbeddedAuthStrategy: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
