// Export du FEC au format réglementaire : 18 colonnes, séparateur tabulation,
// dates AAAAMMJJ, montants avec virgule décimale, fichier nommé <SIREN>FEC<AAAAMMJJ>.txt.
import { COLONNES_FEC, COL } from './plan.js';

const date = (d) => (d ? d.replaceAll('-', '') : '');
const montant = (n) => n.toFixed(2).replace('.', ',');
const texte = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ');

export function fecVersTexte(lignes) {
  const sortie = [COLONNES_FEC.join('\t')];
  for (const l of lignes) {
    const ligne = l.slice(0, 18).map(texte);
    for (const col of ['EcritureDate', 'PieceDate', 'DateLet', 'ValidDate']) ligne[COL[col]] = date(l[COL[col]]);
    ligne[COL.Debit] = montant(l[COL.Debit]);
    ligne[COL.Credit] = montant(l[COL.Credit]);
    sortie.push(ligne.join('\t'));
  }
  return sortie.join('\r\n') + '\r\n';
}

export const nomFichierFec = (siren, cloture) => `${siren}FEC${date(cloture)}.txt`;
