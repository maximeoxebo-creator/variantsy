/**
 * Demande d'avis native de Shopify (App Bridge, Reviews API).
 *
 * À appeler à la fin d'un parcours RÉUSSI — jamais à l'ouverture de l'app, ni
 * derrière un bouton « Laisser un avis ». C'est Shopify qui décide d'afficher
 * la fenêtre : pas dans les 24 h qui suivent l'installation, au plus une fois
 * tous les 60 jours et trois fois par an, jamais sur mobile. Un bouton qui
 * n'ouvre rien passerait pour une panne ; un appel de fin de parcours refusé,
 * lui, ne se voit pas.
 *
 * Un refus est donc le cas NORMAL, pas une erreur. Une boutique de
 * développement lève ces limites : c'est là qu'on teste.
 */
type ReviewsApi = {
  request(): Promise<{ success: boolean; code: string; message: string }>;
};

// Un seul appel par visite : les suivants seraient refusés de toute façon.
let dejaDemande = false;

export function demanderAvis() {
  if (dejaDemande || typeof window === "undefined") return;
  // Lu sur le global plutôt que via useAppBridge : l'appel part d'effets qui
  // n'ont pas à dépendre du hook. L'API vient du script CDN d'App Bridge,
  // d'où la lecture défensive si une version ne l'exposait pas.
  const reviews = (window as unknown as { shopify?: { reviews?: ReviewsApi } }).shopify?.reviews;
  if (!reviews) return;
  dejaDemande = true;
  reviews.request().then(
    (r) => {
      if (!r.success) console.info(`[avis] fenêtre non affichée : ${r.code}`);
    },
    () => {},
  );
}
