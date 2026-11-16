// Génération d'un cas : l'IA propose, le code contrôle. Un cas incohérent est rejeté
// et régénéré (en indiquant à l'IA les erreurs relevées), dans la limite de MAX_TENTATIVES.
import { REFERENTIELS } from './config.js';
import { MOTEURS } from './cycles/index.js';
import { demanderJSON } from './groq.js';
import { identifiant } from './utils.js';

const MAX_TENTATIVES = 4;

function nouvelleMission({ cycle, niveau, referentiel, source, brut, extraitRapport }) {
  return {
    id: identifiant(), cycle, niveau, referentiel, source, creeLe: new Date().toISOString(),
    inspireRapport: !!extraitRapport,
    brut, // seul le JSON brut est stocké : tous les chiffres sont recalculés à chaque ouverture
    etape: 1,
    travail: { risques: '', seuil: { base: 'ca', taux: '', signification: '', planification: '', insignifiant: '', justification: '' }, anomalies: [], conclusion: '' },
    correction: null,
  };
}

/** Recalcule le cas complet d'une mission à partir de son JSON brut. */
export function chargerCas(mission) {
  const { cas, erreurs } = MOTEURS[mission.cycle].construireCas(mission.brut, REFERENTIELS[mission.referentiel]);
  if (!cas) throw new Error('Cas enregistré illisible : ' + erreurs[0]);
  return cas;
}

export function genererMissionHorsLigne({ cycle = 'tresorerie', niveau, referentiel = 'pcg' }) {
  const moteur = MOTEURS[cycle];
  for (let i = 0; i < 20; i++) {
    const brut = moteur.genererCasHorsLigne({ niveau, graine: Date.now() + i * 7919 });
    if (moteur.construireCas(brut, REFERENTIELS[referentiel]).cas) return nouvelleMission({ cycle, niveau, referentiel, source: 'horsligne', brut });
  }
  throw new Error('Le générateur hors-ligne n\'a pas produit de cas cohérent.');
}

export async function genererMissionIA({ cycle = 'tresorerie', niveau, referentiel = 'pcg', extraitRapport = '', parametres, suivi = () => {} }) {
  const moteur = MOTEURS[cycle];
  const ref = REFERENTIELS[referentiel];
  const { systeme, utilisateur } = moteur.construirePrompt({ niveau, referentiel: ref, extraitRapport, graine: Math.floor(Math.random() * 1e6) });
  let erreursPrecedentes = [];
  let derniereErreur = '';
  for (let tentative = 1; tentative <= MAX_TENTATIVES; tentative++) {
    suivi(tentative === 1 ? "L'IA rédige le cas…" : `Cas rejeté par les contrôles (${derniereErreur}) — nouvelle génération ${tentative}/${MAX_TENTATIVES}…`);
    const rappel = erreursPrecedentes.length
      ? `\n\nATTENTION : ta proposition précédente a été rejetée par les contrôles automatiques. Erreurs à ne pas reproduire :\n- ${erreursPrecedentes.slice(0, 8).join('\n- ')}`
      : '';
    let brut;
    try {
      brut = await demanderJSON({ cle: parametres.cleGroq, modele: parametres.modele, systeme, utilisateur: utilisateur + rappel });
    } catch (e) {
      if (e.statut || tentative === MAX_TENTATIVES) throw e; // erreur d'API : inutile d'insister
      derniereErreur = e.message;
      continue;
    }
    const { cas, erreurs } = moteur.construireCas(brut, ref);
    if (cas) return nouvelleMission({ cycle, niveau, referentiel, source: 'ia', brut, extraitRapport });
    erreursPrecedentes = erreurs;
    derniereErreur = erreurs[0];
  }
  throw new Error(`L'IA n'a pas produit de cas cohérent après ${MAX_TENTATIVES} tentatives (dernière erreur : ${derniereErreur}). Réessayez, changez de modèle dans les Paramètres ou utilisez un cas hors-ligne.`);
}
