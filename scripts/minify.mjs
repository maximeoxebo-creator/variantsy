/**
 * Minifie les scripts storefront avant déploiement.
 *
 * Raison d'être : le theme check de Shopify pose un seuil sur le JS d'un bloc
 * d'app, et `variantsy.js` pesait 61 ko en clair — commentaires compris, et ils
 * sont nombreux parce qu'ils documentent des pièges qui ont coûté cher.
 *
 * ⚠️  LE SEUIL PORTE SUR LA TAILLE COMPRESSÉE, pas sur les octets bruts.
 *     La documentation de `AssetSizeAppBlockJavaScript` dit : « The maximum
 *     allowed COMPRESSED size, in bytes, for a single JavaScript file. »
 *     Le CLI Shopify, lui, affiche la taille BRUTE et la compare quand même à
 *     ce seuil : il crie « 26818 B exceeds 10000 B » sur un fichier qui tient
 *     largement une fois gzippé. Son avertissement est donc à ignorer — mais
 *     seulement après avoir vérifié la vraie mesure, que ce script affiche.
 *
 * La source reste donc lisible dans `storefront/`, et `assets/` ne contient que
 * le résultat. Sacrifier les commentaires pour tenir un seuil aurait été le pire
 * des deux mondes.
 *
 * Lancé automatiquement par `predeploy:extension` : impossible de déployer une
 * version non minifiée par distraction.
 */
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
// La source vit HORS de l'extension : Shopify n'autorise que assets, blocks,
// locales et snippets dans une extension de thème, et refuse le déploiement
// dès qu'un autre dossier s'y trouve.
const source = join(racine, "storefront");
const cible = join(racine, "extensions/variant-engine/assets");

// Un seul moteur depuis le retrait des pages de collection.
const fichiers = ["variantsy.js"];

const ko = (chemin) => (statSync(chemin).size / 1024).toFixed(1);

/** Seuil réel de `AssetSizeAppBlockJavaScript`, en octets compressés. */
const SEUIL = 10000;
/** Au-delà, on prévient : la marge devient trop mince pour la prochaine
 *  fonctionnalité, et on préfère l'apprendre ici qu'au moment de soumettre. */
const ALERTE = 0.85;

let depassement = false;

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

  // gzip -9 : c'est ce que sert un CDN, donc c'est la mesure qui compte.
  const compresse = gzipSync(readFileSync(sortie), { level: 9 }).length;
  const part = compresse / SEUIL;
  const verdict = compresse > SEUIL ? "DÉPASSE" : part > ALERTE ? "marge mince" : "ok";

  console.log(
    `${nom} : ${ko(entree)} ko → ${ko(sortie)} ko ` +
      `(${compresse} o compressés, ${Math.round(part * 100)} % du seuil — ${verdict})`,
  );

  if (compresse > SEUIL) depassement = true;
}

if (depassement) {
  console.error(
    `\nAu moins un fichier dépasse ${SEUIL} octets compressés. ` +
      `Le déploiement est interrompu : ce seuil est celui que Shopify vérifie.`,
  );
  process.exit(1);
}
