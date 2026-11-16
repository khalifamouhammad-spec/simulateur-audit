// Moteur comptable générique : aucun chiffre ne vient de l'IA, tout est recalculé ici.
// Une écriture = { id, date, journal, libelle, lignes: [{ compte, libelle, debit, credit }] }
import { enCentimes, enEuros, euro } from './utils.js';

/** Vérifie que chaque écriture est équilibrée. Renvoie la liste des erreurs. */
export function verifierEcritures(ecritures) {
  const erreurs = [];
  for (const e of ecritures) {
    let debit = 0;
    let credit = 0;
    if (!Array.isArray(e.lignes) || e.lignes.length < 2) {
      erreurs.push(`Écriture ${e.id} : au moins deux lignes sont nécessaires.`);
      continue;
    }
    for (const l of e.lignes) {
      const d = enCentimes(l.debit);
      const c = enCentimes(l.credit);
      if (!/^\d{3,8}$/.test(String(l.compte))) erreurs.push(`Écriture ${e.id} : numéro de compte invalide « ${l.compte} ».`);
      if (d < 0 || c < 0) erreurs.push(`Écriture ${e.id} : montant négatif sur le compte ${l.compte}.`);
      if (d > 0 && c > 0) erreurs.push(`Écriture ${e.id} : le compte ${l.compte} est à la fois débité et crédité.`);
      debit += d;
      credit += c;
    }
    if (debit !== credit) {
      erreurs.push(
        `Écriture ${e.id} déséquilibrée : débit ${euro(enEuros(debit))}, crédit ${euro(enEuros(credit))}, écart ${euro(enEuros(debit - credit))}.`
      );
    }
    if (debit === 0) erreurs.push(`Écriture ${e.id} : montant nul.`);
  }
  return erreurs;
}

/** Balance générale calculée à partir des écritures. */
export function calculerBalance(ecritures) {
  const comptes = new Map();
  for (const e of ecritures) {
    for (const l of e.lignes) {
      const num = String(l.compte);
      if (!comptes.has(num)) comptes.set(num, { compte: num, libelle: l.libelle || '', debit: 0, credit: 0 });
      const c = comptes.get(num);
      c.debit += enCentimes(l.debit);
      c.credit += enCentimes(l.credit);
      if (!c.libelle && l.libelle) c.libelle = l.libelle;
    }
  }
  return [...comptes.values()]
    .sort((a, b) => a.compte.localeCompare(b.compte))
    .map((c) => {
      const solde = c.debit - c.credit;
      return {
        compte: c.compte,
        libelle: c.libelle,
        debit: enEuros(c.debit),
        credit: enEuros(c.credit),
        soldeDebiteur: solde > 0 ? enEuros(solde) : 0,
        soldeCrediteur: solde < 0 ? enEuros(-solde) : 0,
      };
    });
}

/**
 * Bilan et compte de résultat simplifiés à partir de la balance.
 * Renvoie aussi les agrégats utiles au calcul du seuil de signification.
 */
export function calculerEtats(balance) {
  const actif = [];
  const passif = [];
  const charges = [];
  const produits = [];
  let ca = 0;

  for (const c of balance) {
    const solde = enCentimes(c.soldeDebiteur) - enCentimes(c.soldeCrediteur); // > 0 : débiteur
    if (solde === 0) continue;
    const classe = c.compte[0];
    const ligne = (montant) => ({ compte: c.compte, libelle: c.libelle, montant: enEuros(montant) });
    const correctif = /^(28|29|39|49|59)/.test(c.compte); // amortissements et dépréciations : en moins de l'actif
    if (classe === '6') charges.push(ligne(solde));
    else if (classe === '7') {
      produits.push(ligne(-solde));
      if (c.compte.startsWith('70')) ca += -solde;
    } else if (classe === '1') passif.push(ligne(-solde));
    else if (classe === '2' || classe === '3' || correctif) actif.push(ligne(solde));
    else if (solde > 0) actif.push(ligne(solde));
    else passif.push(ligne(-solde));
  }

  const total = (l) => l.reduce((s, x) => s + enCentimes(x.montant), 0);
  const resultat = total(produits) - total(charges);
  passif.push({ compte: '12', libelle: "Résultat de l'exercice", montant: enEuros(resultat) });
  const capitauxPropres = passif.filter((l) => /^1[0-4]|^12$/.test(l.compte)).reduce((s, x) => s + enCentimes(x.montant), 0);

  return {
    bilan: { actif, passif, totalActif: enEuros(total(actif)), totalPassif: enEuros(total(passif)) },
    resultat: { charges, produits, totalCharges: enEuros(total(charges)), totalProduits: enEuros(total(produits)) },
    agregats: {
      chiffreAffaires: enEuros(ca),
      resultatNet: enEuros(resultat),
      totalBilan: enEuros(total(actif)),
      capitauxPropres: enEuros(capitauxPropres),
    },
    equilibre: total(actif) === total(passif),
  };
}
