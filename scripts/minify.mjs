/**
 * Minifie les scripts storefront avant déploiement.
 *
 * Raison d'être : le theme check de Shopify refuse un fichier JS de bloc d'app
 * au-delà de 10 ko, et `variantsy.js` en pesait 61 en clair — commentaires
 * compris, et ils sont nombreux parce qu'ils documentent des pièges qui ont
 * coûté cher.
 *
 * La source reste donc lisible dans `storefront/`, et `assets/` ne contient que
 * le résultat. Sacrifier les commentaires pour tenir un seuil aurait été le pire
 * des deux mondes.
 *
 * Lancé automatiquement par `predeploy:extension` : impossible de déployer une
 * version non minifiée par distraction.
 */
import { build } from "esbuild";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
// La source vit HORS de l'extension : Shopify n'autorise que assets, blocks,
// locales et snippets dans une extension de thème, et refuse le déploiement
// dès qu'un autre dossier s'y trouve.
const source = join(racine, "storefront");
const cible = join(racine, "extensions/variant-engine/assets");

const fichiers = ["variantsy.js", "variantsy-collection.js"];

const ko = (chemin) => (statSync(chemin).size / 1024).toFixed(1);

for (const nom of fichiers) {
  const entree = join(source, nom);
  const sortie = join(cible, nom);

  await build({
    entryPoints: [entree],
    outfile: sortie,
    minify: true,
    // Cible volontairement large : ce code tourne sur les navigateurs des
    // clients d'un marchand, pas sur ceux d'un développeur.
    target: ["es2017"],
    legalComments: "none",
    logLevel: "error",
  });

  console.log(`${nom} : ${ko(entree)} ko → ${ko(sortie)} ko`);
}
