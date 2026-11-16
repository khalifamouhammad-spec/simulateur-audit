// Sauvegarde locale (localStorage). Point unique d'accès : un passage à Firebase
// plus tard ne demandera de modifier que ce fichier.
import { MODELE_GROQ_DEFAUT } from './config.js';

const CLE_PARAMETRES = 'simulateur-audit.parametres';
const CLE_MISSIONS = 'simulateur-audit.missions';

function lire(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : defaut;
  } catch {
    return defaut;
  }
}

function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false;
  }
}

export function lireParametres() {
  return { cleGroq: '', modele: MODELE_GROQ_DEFAUT, referentiel: 'pcg', ...lire(CLE_PARAMETRES, {}) };
}
export const ecrireParametres = (p) => ecrire(CLE_PARAMETRES, p);

/** Une mission = { id, cycle, niveau, referentiel, source, creeLe, brut, etape, travail, correction } */
export const lireMissions = () => lire(CLE_MISSIONS, []);
export const lireMission = (id) => lireMissions().find((m) => m.id === id) || null;

export function enregistrerMission(mission) {
  const missions = lireMissions();
  const i = missions.findIndex((m) => m.id === mission.id);
  if (i >= 0) missions[i] = mission;
  else missions.unshift(mission);
  return ecrire(CLE_MISSIONS, missions);
}

export function supprimerMission(id) {
  return ecrire(CLE_MISSIONS, lireMissions().filter((m) => m.id !== id));
}
