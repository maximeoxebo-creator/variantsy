import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

/**
 * Singleton Prisma.
 *
 * PIÈGE N°3 (Neon scale-to-zero) — voir CLAUDE.md.
 * Le plan gratuit Neon endort le compute après 5 min. Le premier appel après
 * la mise en veille peut prendre plusieurs secondes. Deux garde-fous ici :
 *
 *  1. `connect_timeout` / `pool_timeout` généreux dans DATABASE_URL (.env.example)
 *  2. `withRetry()` ci-dessous, à utiliser pour toute requête sur un chemin
 *     critique (loader admin, endpoint storefront). Une erreur de connexion
 *     transitoire ne doit JAMAIS remonter jusqu'au marchand.
 */
const prisma: PrismaClient =
  global.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

export default prisma;

/** Codes d'erreur Prisma qui signalent un problème de connexion, pas de données. */
const TRANSIENT_CODES = new Set(["P1000", "P1001", "P1002", "P1008", "P1017", "P2024"]);

function isTransient(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  if (code && TRANSIENT_CODES.has(code)) return true;
  const message = String((error as Error)?.message ?? "");
  return (
    message.includes("Can't reach database server") ||
    message.includes("Connection terminated") ||
    message.includes("timed out") ||
    message.includes("ECONNRESET")
  );
}

/**
 * Rejoue une requête Prisma quand l'échec vient du réveil du compute Neon.
 * Backoff : 500ms, 1500ms, 3500ms → ~5,5 s de marge, largement suffisant
 * pour un cold-start Neon (mesuré ~1-3 s).
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransient(error) || i === attempts - 1) throw error;
      const delay = 500 * Math.pow(2, i);
      console.warn(`[db] tentative ${i + 1}/${attempts} échouée (transitoire), retry dans ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
