// Registre des cycles. Chaque cycle expose la même interface :
//   construireCas(brut, referentiel) -> { cas, erreurs }   contrôle et calcule tout à partir du JSON brut
//   construirePrompt(options)        -> { systeme, utilisateur }
//   genererCasHorsLigne(options)     -> JSON brut (sans IA)
//   afficherTravaux(conteneur, contexte)                   écran « Travaux » propre au cycle
// Pour ajouter un cycle (ventes, achats, stocks...) : créer ses fichiers dans ce dossier,
// l'enregistrer ici et passer « disponible » à true dans config.js.
import { construireCas } from './tresorerie.js';
import { construirePrompt } from './tresorerie-prompt.js';
import { genererCasHorsLigne } from './tresorerie-horsligne.js';

export const MOTEURS = {
  tresorerie: { construireCas, construirePrompt, genererCasHorsLigne, vue: () => import('./tresorerie-vue.js') },
};
