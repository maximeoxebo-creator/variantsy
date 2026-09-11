/**
 * Ce que le forfait gratuit donne, et ce qu'il retient.
 *
 * Trois lignes décident de tout : « abonnement vide vaut gratuit », « gratuit
 * coupe la galerie », « gratuit coupe les pages liées ». Une erreur dans un
 * sens offre le payant à tout le monde ; dans l'autre, elle retire à un
 * marchand ce qu'il paie. Les deux méritent un garde-fou.
 *
 * settings.server importe Prisma. On le remplace ici par un bouchon : le test
 * porte sur des fonctions PURES, il n'a aucune base à joindre.
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "vtsy-plan-"));
const entree = join(dir, "entree.ts");
writeFileSync(
  entree,
  `export { estPro, toStorefrontConfig, DEFAULT_SETTINGS } from "${join(process.cwd(), "app/settings.server.ts")}";
   export { planActuel } from "${join(process.cwd(), "app/billing.server.ts")}";
   export { stylePublie } from "${join(process.cwd(), "app/style-css.server.ts")}";`,
);

const bouchonPrisma = {
  name: "bouchon",
  setup(b) {
    b.onResolve({ filter: /db\.server$/ }, () => ({ path: "bouchon-db", namespace: "bouchon" }));
    b.onLoad({ filter: /.*/, namespace: "bouchon" }, () => ({
      contents:
        "const prisma = {}; export default prisma; export { prisma };" +
        "export const withRetry = (f) => f();",
      loader: "js",
    }));
  },
};

// Le paquet est écrit DANS le projet, pas dans un dossier temporaire : les
// dépendances laissées externes — @prisma/client — ne se résolvent que depuis
// l'arborescence du projet.
const sortie = join(process.cwd(), "scripts", ".plan-bundle.mjs");
await build({
  entryPoints: [entree],
  outfile: sortie,
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  plugins: [bouchonPrisma],
  logLevel: "error",
});

const { estPro, toStorefrontConfig, DEFAULT_SETTINGS, planActuel, stylePublie } = await import(
  pathToFileURL(sortie).href
);

const resultats = [];
const verifie = (nom, condition, detail) =>
  resultats.push({ nom, ok: Boolean(condition), detail });

const reglages = (plan) => ({ ...DEFAULT_SETTINGS, galleryEnabled: true, plan });

/* --- Ce que chaque plan sert ------------------------------------------- */
const gratuit = toStorefrontConfig(reglages("free"), []);
const paye = toStorefrontConfig(reglages("pro"), []);

verifie("Gratuit : la galerie par couleur est coupée", gratuit.gallery.enabled === false);
verifie("Gratuit : les pages liées sont coupées", gratuit.linked === false);
verifie("Gratuit : les pastilles restent servies", Boolean(gratuit.style.shape));
verifie("Gratuit : le titre dynamique reste servi", "updateTitle" in gratuit.behavior);
verifie("Pro : la galerie est servie", paye.gallery.enabled === true);
verifie("Pro : les pages liées sont servies", paye.linked === true);

/* --- Le marchand garde la main sur ce qu'il paie ------------------------ */
const proEteint = toStorefrontConfig({ ...reglages("pro"), galleryEnabled: false }, []);
verifie(
  "Pro : un marchand peut toujours éteindre sa galerie",
  proEteint.gallery.enabled === false,
);

/* --- Le repli quand la base est injoignable ---------------------------- */
verifie(
  "Sans colonne plan, on sert le gratuit",
  estPro(DEFAULT_SETTINGS) === false,
  "un repli ne doit jamais offrir le payant",
);

/* --- Ce que le bloc Liquid reçoit -------------------------------------- */
verifie("Le Liquid apprend que les pages liées sont fermées", stylePublie(gratuit).linked === false);
verifie("Le Liquid apprend qu'elles sont ouvertes", stylePublie(paye).linked === true);

/* --- La lecture du plan chez Shopify ----------------------------------- */
const admin = (subs) => ({
  graphql: async () => ({
    json: async () => ({
      data: { currentAppInstallation: { activeSubscriptions: subs } },
    }),
  }),
});

const vide = await planActuel(admin([]), "x.myshopify.com");
verifie(
  "Aucun abonnement vaut GRATUIT, jamais une redirection",
  vide.plan === "free",
  "un forfait gratuit Shopify ne crée aucun abonnement : rediriger ici enfermerait la boutique",
);

const abonne = await planActuel(admin([{ name: "Pro", status: "ACTIVE" }]), "x.myshopify.com");
verifie("Un abonnement actif vaut PRO", abonne.plan === "pro");

const casse = await planActuel(
  { graphql: async () => { throw new Error("réseau"); } },
  "x.myshopify.com",
);
verifie(
  "Shopify injoignable ne rétrograde personne",
  casse.plan === null,
  "null veut dire « je ne sais pas », pas « gratuit »",
);

verifie(
  "La page de tarification reste joignable",
  vide.pricingUrl.includes("/charges/") && vide.pricingUrl.includes("/pricing_plans"),
  vide.pricingUrl,
);

rmSync(sortie, { force: true });

const echecs = resultats.filter((r) => !r.ok);
for (const r of resultats) {
  console.log(`  ${r.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${r.nom}${r.ok || !r.detail ? "" : `\n      → ${r.detail}`}`);
}
console.log(`\n${resultats.length - echecs.length}/${resultats.length} tests passés`);
process.exit(echecs.length ? 1 : 0);
