// Contrôles et états calculés à partir des lignes de FEC. Aucun chiffre ne vient de l'IA.
import { COL } from './plan.js';

const c = (n) => Math.round(n * 100);

/**
 * Contrôles du FEC : équilibre de chaque écriture, équilibre général, dates dans l'exercice,
 * numérotation continue par journal, lettrage équilibré, champs obligatoires.
 */
export function verifierFec(lignes, { debut, fin }) {
  const erreurs = [];
  const signaler = (msg) => { if (erreurs.length < 30) erreurs.push(msg); };
  const ecritures = new Map();
  const lettrages = new Map();
  let debit = 0; let credit = 0;
  for (const l of lignes) {
    const num = l[COL.EcritureNum];
    const d = c(l[COL.Debit]); const k = c(l[COL.Credit]);
    if (!l[COL.JournalCode] || !num || !l[COL.EcritureDate] || !l[COL.CompteNum] || !l[COL.CompteLib] || !l[COL.PieceRef] || !l[COL.PieceDate] || !l[COL.EcritureLib] || !l[COL.ValidDate]) signaler(`Écriture ${num} : champ obligatoire vide (compte ${l[COL.CompteNum]}).`);
    if (d < 0 || k < 0 || (d > 0 && k > 0) || (d === 0 && k === 0)) signaler(`Écriture ${num} : montant invalide sur le compte ${l[COL.CompteNum]}.`);
    if (l[COL.EcritureDate] < debut || l[COL.EcritureDate] > fin) signaler(`Écriture ${num} : date ${l[COL.EcritureDate]} hors exercice.`);
    if (/^4(01|04|08|11)/.test(l[COL.CompteNum]) && !l[COL.CompAuxNum]) signaler(`Écriture ${num} : compte de tiers ${l[COL.CompteNum]} sans compte auxiliaire.`);
    const e = ecritures.get(num) || { journal: l[COL.JournalCode], date: l[COL.EcritureDate], solde: 0, lignes: 0 };
    if (e.date !== l[COL.EcritureDate] || e.journal !== l[COL.JournalCode]) signaler(`Écriture ${num} : lignes de dates ou de journaux différents.`);
    e.solde += d - k; e.lignes++;
    ecritures.set(num, e);
    debit += d; credit += k;
    if (l[COL.EcritureLet]) {
      const cle = `${l[COL.CompteNum]}|${l[COL.CompAuxNum]}|${l[COL.EcritureLet]}`;
      lettrages.set(cle, (lettrages.get(cle) || 0) + d - k);
      if (!l[COL.DateLet]) signaler(`Écriture ${num} : lettrage sans date.`);
    }
  }
  const compteurs = {};
  for (const [num, e] of ecritures) {
    if (e.solde !== 0) signaler(`Écriture ${num} déséquilibrée (écart ${e.solde / 100}).`);
    if (e.lignes < 2) signaler(`Écriture ${num} : une seule ligne.`);
    const rang = Number(num.slice(e.journal.length));
    compteurs[e.journal] = (compteurs[e.journal] || 0) + 1;
    if (rang !== compteurs[e.journal]) signaler(`Journal ${e.journal} : rupture de numérotation à ${num}.`);
  }
  for (const [cle, solde] of lettrages) if (solde !== 0) signaler(`Lettrage déséquilibré : ${cle}.`);
  if (debit !== credit) signaler(`Total débit (${debit / 100}) différent du total crédit (${credit / 100}).`);
  return { erreurs, nbLignes: lignes.length, nbEcritures: ecritures.size, totalDebit: debit / 100, totalCredit: credit / 100 };
}

/** Balance générale : une ligne par compte. */
export function calculerBalance(lignes) {
  const comptes = new Map();
  for (const l of lignes) {
    const num = l[COL.CompteNum];
    const x = comptes.get(num) || { compte: num, libelle: l[COL.CompteLib], debit: 0, credit: 0 };
    x.debit += c(l[COL.Debit]); x.credit += c(l[COL.Credit]);
    comptes.set(num, x);
  }
  return [...comptes.values()].sort((a, b) => a.compte.localeCompare(b.compte)).map((x) => {
    const solde = x.debit - x.credit;
    return { compte: x.compte, libelle: x.libelle, debit: x.debit / 100, credit: x.credit / 100, soldeDebiteur: solde > 0 ? solde / 100 : 0, soldeCrediteur: solde < 0 ? -solde / 100 : 0 };
  });
}

// Rubriques du bilan et du compte de résultat (préfixes de comptes).
const ACTIF = [
  ['Immobilisations (valeur brute)', /^2[0-7]/], ['Amortissements et dépréciations', /^2[89]/], ['Stocks', /^3/],
  ['Clients et comptes rattachés', /^41/], ['Autres créances', /^4/], ['Disponibilités', /^5/],
];
const PASSIF = [
  ['Capital ou fonds associatifs', /^10[1-5]/], ['Réserves et report à nouveau', /^1(06|1)/], ["Résultat de l'exercice", /^12/], ['Provisions', /^15/],
  ['Emprunts et dettes financières', /^1[67]/], ['Fournisseurs et comptes rattachés', /^40/], ['Dettes fiscales et sociales', /^4[2-4]/], ['Autres dettes', /^[45]/],
];
const RESULTAT = [
  ["Chiffre d'affaires", /^70/, 1, 'exploitation'], ["Subventions d'exploitation", /^74/, 1, 'exploitation'], ['Autres produits', /^7[123589]/, 1, 'exploitation'],
  ['Achats', /^60[^3]/, -1, 'exploitation'], ['Variation de stocks', /^603/, -1, 'exploitation'], ['Autres achats et charges externes', /^6[12]/, -1, 'exploitation'],
  ['Impôts et taxes', /^63/, -1, 'exploitation'], ['Salaires et traitements', /^641/, -1, 'exploitation'], ['Charges sociales', /^64[^1]/, -1, 'exploitation'],
  ['Dotations aux amortissements et dépréciations', /^68/, -1, 'exploitation'], ['Autres charges', /^65/, -1, 'exploitation'],
  ['Produits financiers', /^76/, 1, 'financier'], ['Charges financières', /^66/, -1, 'financier'],
  ['Produits exceptionnels', /^77/, 1, 'exceptionnel'], ['Charges exceptionnelles', /^67/, -1, 'exceptionnel'],
  ['Impôt sur les bénéfices', /^69/, -1, 'impot'],
];

/**
 * Bilan et compte de résultat. Les comptes de tiers sont classés d'après leur solde par compte
 * auxiliaire (un client créditeur va au passif, un fournisseur débiteur à l'actif).
 */
export function calculerEtats(lignes) {
  const soldes = new Map(); // compte|aux -> { compte, libelle, solde }
  for (const l of lignes) {
    const cle = `${l[COL.CompteNum]}|${l[COL.CompAuxNum]}`;
    const x = soldes.get(cle) || { compte: l[COL.CompteNum], libelle: l[COL.CompteLib], solde: 0 };
    x.solde += c(l[COL.Debit]) - c(l[COL.Credit]);
    soldes.set(cle, x);
  }
  const rubriques = (definition) => definition.map(([libelle]) => ({ libelle, montant: 0, comptes: new Map() }));
  const actif = rubriques(ACTIF); const passif = rubriques(PASSIF); const resultat = rubriques(RESULTAT);
  const ajouter = (rubrique, x, montant) => { rubrique.montant += montant; rubrique.comptes.set(x.compte, (rubrique.comptes.get(x.compte) || 0) + montant); };
  for (const x of soldes.values()) {
    if (!x.solde) continue;
    const classe = x.compte[0];
    if (classe === '6' || classe === '7') {
      const i = RESULTAT.findIndex(([, motif]) => motif.test(x.compte));
      if (i >= 0) ajouter(resultat[i], x, -x.solde); // produits positifs, charges négatives
      continue;
    }
    const cotePassif = classe === '1' || ((classe === '4' || classe === '5') && x.solde < 0);
    if (cotePassif) ajouter(passif[PASSIF.findIndex(([, motif]) => motif.test(x.compte))], x, -x.solde);
    else ajouter(actif[ACTIF.findIndex(([, motif]) => motif.test(x.compte))], x, x.solde);
  }
  const total = (liste) => liste.reduce((s, r) => s + r.montant, 0);
  const resultatCompte = total(resultat);
  const totalActif = total(actif);
  const resultatBilan = totalActif - total(passif); // résultat non encore viré au compte 12
  passif[2].montant += resultatBilan;
  const par = (nature) => resultat.filter((_, i) => RESULTAT[i][3] === nature).reduce((s, r) => s + r.montant, 0);
  const sortie = (liste) => liste.map((r) => ({ libelle: r.libelle, montant: r.montant / 100, comptes: [...r.comptes].sort((a, b) => a[0].localeCompare(b[0])).map(([compte, m]) => ({ compte, montant: m / 100 })) }));
  const capitauxPropres = passif[0].montant + passif[1].montant + passif[2].montant;
  return {
    actif: sortie(actif), passif: sortie(passif), resultat: sortie(resultat),
    totalActif: totalActif / 100, totalPassif: total(passif) / 100,
    agregats: {
      chiffreAffaires: resultat[0].montant / 100, produitsExploitation: (resultat[0].montant + resultat[1].montant + resultat[2].montant) / 100,
      resultatExploitation: par('exploitation') / 100, resultatFinancier: par('financier') / 100, resultatExceptionnel: par('exceptionnel') / 100,
      impot: -par('impot') / 100, resultatNet: resultatCompte / 100, totalBilan: totalActif / 100, capitauxPropres: capitauxPropres / 100,
    },
    controles: {
      bilanEquilibre: totalActif === total(passif),
      resultatIdentique: resultatBilan === resultatCompte,
      resultatBilan: resultatBilan / 100, resultatCompteDeResultat: resultatCompte / 100,
    },
  };
}
