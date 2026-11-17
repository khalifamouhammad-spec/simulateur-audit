// Revue analytique N / N-1 calculée à partir des deux FEC : postes du bilan et du compte de
// résultat, ratios, évolution mensuelle. Aucune donnée ne vient de l'IA.
import { COL } from './plan.js';
import { calculerEtats } from './compta.js';

const c = (n) => Math.round(n * 100);

/** Solde (crédit - débit) des comptes commençant par un des préfixes, hors à-nouveaux si demandé. */
function mouvement(lignes, prefixes, { journaux = null, sens = 1 } = {}) {
  let total = 0;
  for (const l of lignes) {
    if (journaux && !journaux.includes(l[COL.JournalCode])) continue;
    if (prefixes.some((p) => l[COL.CompteNum].startsWith(p))) total += c(l[COL.Credit]) - c(l[COL.Debit]);
  }
  return (sens * total) / 100;
}

function ratiosDe(lignes, etats) {
  const a = etats.agregats;
  const rubrique = (liste, libelle) => liste.find((r) => r.libelle === libelle)?.montant || 0;
  const ca = a.chiffreAffaires;
  const achats = -(rubrique(etats.resultat, 'Achats') + rubrique(etats.resultat, 'Variation de stocks'));
  const externes = -rubrique(etats.resultat, 'Autres achats et charges externes');
  const salaires = -rubrique(etats.resultat, 'Salaires et traitements');
  const sociales = -rubrique(etats.resultat, 'Charges sociales');
  const dotations = -rubrique(etats.resultat, 'Dotations aux amortissements et dépréciations');
  const clients = rubrique(etats.actif, 'Clients et comptes rattachés');
  const fournisseurs = rubrique(etats.passif, 'Fournisseurs et comptes rattachés');
  const stocks = rubrique(etats.actif, 'Stocks');
  const immos = rubrique(etats.actif, 'Immobilisations (valeur brute)');
  const tvaCollectee = mouvement(lignes, ['44571'], { journaux: ['VE'] });
  const avantImpot = a.resultatNet + a.impot;
  const div = (x, y) => (y ? x / y : null);
  return {
    margeBrute: div(ca - achats, ca), externes: div(externes, a.produitsExploitation), personnel: div(salaires + sociales, a.produitsExploitation),
    chargesSociales: div(sociales, salaires), delaiClients: div(clients * 360, ca), delaiFournisseurs: div(fournisseurs * 360, achats + externes),
    rotationStocks: stocks ? div(stocks * 360, achats) : null, tva: div(tvaCollectee, ca), is: avantImpot > 0 ? div(a.impot, avantImpot) : null,
    dotations: div(dotations, immos), rentabilite: div(a.resultatNet, a.produitsExploitation),
  };
}

const RATIOS = [
  ['margeBrute', 'Taux de marge brute (CA − achats consommés) / CA', '%'], ['externes', 'Charges externes / produits d\'exploitation', '%'],
  ['personnel', 'Charges de personnel / produits d\'exploitation', '%'], ['chargesSociales', 'Charges sociales / salaires', '%'],
  ['delaiClients', 'Crédit clients (créances / CA HT × 360)', 'j'], ['delaiFournisseurs', 'Crédit fournisseurs (dettes / achats et charges externes × 360)', 'j'],
  ['rotationStocks', 'Rotation des stocks (stock / achats consommés × 360)', 'j'], ['tva', 'TVA collectée / chiffre d\'affaires', '%'],
  ['is', 'Taux effectif d\'impôt (IS / résultat avant impôt)', '%'], ['dotations', 'Dotations / immobilisations brutes', '%'], ['rentabilite', 'Résultat net / produits d\'exploitation', '%'],
];

/**
 * seuilMontant : variation en valeur absolue à partir de laquelle un poste est signalé (euros).
 * Un poste est significatif si sa variation dépasse ce seuil ET 10 % ; un ratio s'il varie de plus de 10 % en relatif.
 */
export function revueAnalytique(lignesN, lignesN1, seuilMontant) {
  const e = calculerEtats(lignesN);
  const p = calculerEtats(lignesN1);
  const postes = [];
  for (const [nature, cle] of [['Actif', 'actif'], ['Passif', 'passif'], ['Résultat', 'resultat']]) {
    e[cle].forEach((r, i) => {
      const n1 = p[cle][i].montant;
      if (!r.montant && !n1) return;
      const variation = Math.round((r.montant - n1) * 100) / 100;
      const pct = n1 ? (variation / Math.abs(n1)) * 100 : null;
      postes.push({ id: `${cle}_${i}`, nature, libelle: r.libelle, n: r.montant, n1, variation, pct, significatif: Math.abs(variation) >= seuilMontant && (pct == null || Math.abs(pct) >= 10) });
    });
  }
  const rn = ratiosDe(lignesN, e); const rp = ratiosDe(lignesN1, p);
  const ratios = RATIOS.filter(([id]) => rn[id] != null || rp[id] != null).map(([id, libelle, unite]) => {
    const n = rn[id]; const n1 = rp[id];
    const relatif = n != null && n1 ? Math.abs((n - n1) / n1) : null;
    return { id: `ratio_${id}`, libelle, unite, n, n1, significatif: relatif != null && relatif >= 0.1 };
  });
  // Évolution mensuelle : chiffre d'affaires et taux de charges sociales
  const parMois = (lignes) => {
    const mois = Array.from({ length: 12 }, () => ({ ca: 0, salaires: 0, sociales: 0 }));
    for (const l of lignes) {
      const m = mois[Number(l[COL.EcritureDate].slice(5, 7)) - 1];
      const compte = l[COL.CompteNum];
      const net = c(l[COL.Credit]) - c(l[COL.Debit]);
      if (compte.startsWith('70')) m.ca += net;
      else if (compte.startsWith('6411')) m.salaires -= net;
      else if (compte.startsWith('6451')) m.sociales -= net;
    }
    return mois;
  };
  const mn = parMois(lignesN); const mp = parMois(lignesN1);
  const mensuel = mn.map((m, i) => ({
    mois: i + 1, caN: m.ca / 100, caN1: mp[i].ca / 100,
    tauxSocialN: m.salaires ? m.sociales / m.salaires : null, tauxSocialN1: mp[i].salaires ? mp[i].sociales / mp[i].salaires : null,
  }));
  // Un mois est signalé si son chiffre d'affaires s'écarte fortement de N-1 (plus de 40 % et plus de
  // 2 % du CA annuel) ou si le taux de charges sociales décroche de plus de 5 points.
  const plancher = Math.max(seuilMontant, e.agregats.chiffreAffaires * 0.02);
  for (const m of mensuel) {
    const ecart = Math.abs(m.caN - m.caN1);
    m.significatif = (!!m.caN1 && ecart / Math.abs(m.caN1) >= 0.4 && ecart >= plancher)
      || (m.tauxSocialN != null && m.tauxSocialN1 != null && Math.abs(m.tauxSocialN - m.tauxSocialN1) >= 0.05);
  }
  return { postes, ratios, mensuel, agregats: { n: e.agregats, n1: p.agregats } };
}
