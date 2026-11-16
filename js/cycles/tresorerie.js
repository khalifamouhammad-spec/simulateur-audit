// Cycle trésorerie : transforme le JSON brut (IA ou générateur hors-ligne) en cas complet.
// L'IA ne fournit ni solde ni total : à partir de la balance d'ouverture et de la liste des
// opérations (date comptable + date en banque), ce module construit les écritures, le grand
// livre de la banque, le relevé, le rapprochement et les états financiers, puis contrôle tout.
import { TYPES_ANOMALIE } from '../config.js';
import { verifierEcritures, calculerBalance, calculerEtats } from '../compta.js';
import { enCentimes, enEuros, estDateISO, ajouterJours, ecartJours, dateFr, euro } from '../utils.js';

const MIN_OPERATIONS = 25;
const MAX_OPERATIONS = 90;

export function construireCas(brut, referentiel) {
  const erreurs = [];
  const B = referentiel.compteBanque;
  if (!brut || typeof brut !== 'object') return { cas: null, erreurs: ['Le JSON du cas est vide ou illisible.'] };

  // --- Fiche entreprise et période ---
  const ent = brut.entreprise || {};
  for (const champ of ['nom', 'secteur', 'forme_juridique', 'contexte']) {
    if (!ent[champ] || typeof ent[champ] !== 'string') erreurs.push(`entreprise.${champ} est manquant.`);
  }
  const debut = brut.exercice?.periode_debut;
  const fin = brut.exercice?.cloture;
  if (!estDateISO(debut) || !estDateISO(fin)) {
    return { cas: null, erreurs: [...erreurs, 'exercice.periode_debut et exercice.cloture doivent être des dates AAAA-MM-JJ.'] };
  }
  const duree = ecartJours(debut, fin);
  if (duree < 25 || duree > 100) erreurs.push(`La période étudiée doit durer de 1 à 3 mois (ici ${duree} jours).`);

  // --- Balance d'ouverture ---
  const balanceOuverture = Array.isArray(brut.balance_ouverture) ? brut.balance_ouverture : [];
  if (balanceOuverture.length < 6) erreurs.push("balance_ouverture doit contenir au moins 6 comptes.");
  const lignesBanque = balanceOuverture.filter((l) => String(l.compte).startsWith(B));
  if (lignesBanque.length !== 1) erreurs.push(`balance_ouverture doit contenir exactement une ligne pour le compte ${B} (banque).`);
  for (const [prefixe, nom] of [['1', 'capitaux (classe 1)'], ['6', 'charges (classe 6)'], ['70', 'ventes (comptes 70)']]) {
    if (!balanceOuverture.some((l) => String(l.compte).startsWith(prefixe))) erreurs.push(`balance_ouverture : aucun compte de ${nom}.`);
  }

  // --- Opérations ---
  const vues = new Set();
  const ops = [];
  for (const o of Array.isArray(brut.operations) ? brut.operations : []) {
    const id = String(o.id ?? '');
    const p = `Opération ${id || '?'}`;
    if (!id || vues.has(id)) { erreurs.push(`${p} : identifiant manquant ou en double.`); continue; }
    vues.add(id);
    const dCompta = o.date_compta || null;
    const dBanque = o.date_banque || null;
    const montant = enCentimes(o.montant);
    const montantBanque = o.montant_banque == null ? montant : enCentimes(o.montant_banque);
    let valide = true;
    const refuser = (msg) => { erreurs.push(`${p} : ${msg}`); valide = false; };
    if (o.sens !== 'encaissement' && o.sens !== 'decaissement') refuser('sens doit valoir « encaissement » ou « decaissement ».');
    if (!(montant > 0) || !(montantBanque > 0)) refuser('le montant doit être strictement positif.');
    if (!dCompta && !dBanque) refuser('date_compta ou date_banque est obligatoire.');
    if (dCompta && !estDateISO(dCompta)) refuser('date_compta invalide.');
    if (dBanque && !estDateISO(dBanque)) refuser('date_banque invalide.');
    if (!/^\d{3,8}$/.test(String(o.contrepartie)) || String(o.contrepartie).startsWith(B)) refuser(`compte de contrepartie invalide « ${o.contrepartie} ».`);
    if (!o.libelle) refuser('libellé manquant.');
    if (!valide) continue;
    if (dCompta && dCompta > fin) refuser(`date_compta (${dCompta}) postérieure à la clôture.`);
    if (dCompta && ecartJours(dCompta, debut) > 1100) refuser('date_compta trop ancienne (plus de 3 ans).');
    if (dBanque && dBanque > ajouterJours(fin, 45)) refuser('date_banque trop éloignée de la clôture (45 jours maximum).');
    if (dCompta && dBanque && dCompta < debut && dBanque < debut) refuser("opération entièrement antérieure à la période : à retirer.");
    if (!valide) continue;
    ops.push({
      id,
      libelle: String(o.libelle),
      libelleBanque: String(o.libelle_banque || o.libelle).toUpperCase(),
      piece: String(o.piece || ''),
      sens: o.sens,
      signe: o.sens === 'encaissement' ? 1 : -1,
      dCompta,
      dBanque,
      mCompta: dCompta ? montant : null,
      mBanque: dBanque ? montantBanque : null,
      contrepartie: String(o.contrepartie),
      contrepartieLibelle: String(o.contrepartie_libelle || ''),
      enBanque: !!dBanque && dBanque <= fin, // figure sur un relevé au plus tard à la clôture
    });
  }
  const parId = new Map(ops.map((o) => [o.id, o]));
  const dansPeriode = ops.filter((o) => o.dCompta && o.dCompta >= debut);
  if (dansPeriode.length < MIN_OPERATIONS) erreurs.push(`Le grand livre doit contenir au moins ${MIN_OPERATIONS} opérations comptabilisées sur la période (ici ${dansPeriode.length}).`);
  if (dansPeriode.length > MAX_OPERATIONS) erreurs.push(`Trop d'opérations (${dansPeriode.length}, maximum ${MAX_OPERATIONS}).`);

  if (erreurs.length) return { cas: null, erreurs };

  // --- Écritures : à-nouveaux + une écriture de banque par opération comptabilisée sur la période ---
  const ecritures = [{
    id: 'AN',
    date: debut,
    journal: 'AN',
    libelle: `Balance de l'exercice avant mouvements de banque depuis le ${dateFr(debut)}`,
    lignes: balanceOuverture.map((l) => ({ compte: String(l.compte), libelle: String(l.libelle || ''), debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
  }];
  for (const o of dansPeriode) {
    const m = enEuros(o.mCompta);
    const entree = o.sens === 'encaissement';
    ecritures.push({
      id: o.id,
      date: o.dCompta,
      journal: 'BQ',
      libelle: o.libelle,
      lignes: [
        { compte: B, libelle: 'Banque', debit: entree ? m : 0, credit: entree ? 0 : m },
        { compte: o.contrepartie, libelle: o.contrepartieLibelle, debit: entree ? 0 : m, credit: entree ? m : 0 },
      ],
    });
  }
  erreurs.push(...verifierEcritures(ecritures));
  if (erreurs.length) return { cas: null, erreurs };

  const balance = calculerBalance(ecritures);
  const etats = calculerEtats(balance);
  if (!etats.equilibre) erreurs.push('Le bilan calculé n\'est pas équilibré.');
  if (etats.agregats.chiffreAffaires <= 0) erreurs.push('Le chiffre d\'affaires calculé est nul ou négatif.');
  if (etats.agregats.totalBilan <= 0) erreurs.push('Le total du bilan calculé est nul ou négatif.');

  // --- Grand livre du compte banque ---
  const lb = lignesBanque[0];
  const soldeOuvertureCompta = enCentimes(lb.debit) - enCentimes(lb.credit);
  let solde = soldeOuvertureCompta;
  const parDate = (cle) => (a, b) => a[cle].localeCompare(b[cle]) || a.id.localeCompare(b.id);
  const grandLivre = [...dansPeriode].sort(parDate('dCompta')).map((o) => {
    solde += o.signe * o.mCompta;
    return {
      ligneId: 'gl:' + o.id, opIds: [o.id], date: o.dCompta, piece: o.piece, libelle: o.libelle,
      contrepartie: o.contrepartie,
      debit: o.signe > 0 ? enEuros(o.mCompta) : 0, credit: o.signe < 0 ? enEuros(o.mCompta) : 0, solde: enEuros(solde),
    };
  });
  const soldeClotureCompta = solde;

  // --- Relevé bancaire (débit = sortie, crédit = entrée, du point de vue de la banque) ---
  const avantCompta = (o) => !!o.dCompta && o.dCompta < debut;
  const avantBanque = (o) => !!o.dBanque && o.dBanque < debut;
  let soldeBanque = soldeOuvertureCompta;
  for (const o of ops) {
    if (avantCompta(o) && !avantBanque(o)) soldeBanque -= o.signe * o.mCompta;
    if (avantBanque(o) && !avantCompta(o)) soldeBanque += o.signe * o.mBanque;
  }
  const soldeOuvertureBanque = soldeBanque;
  const ligneReleve = (prefixe) => (o) => {
    soldeBanque += o.signe * o.mBanque;
    return {
      ligneId: prefixe + o.id, opIds: [o.id], date: o.dBanque, libelle: o.libelleBanque,
      debit: o.signe < 0 ? enEuros(o.mBanque) : 0, credit: o.signe > 0 ? enEuros(o.mBanque) : 0, solde: enEuros(soldeBanque),
    };
  };
  const lignesReleve = ops.filter((o) => o.dBanque && o.dBanque >= debut && o.dBanque <= fin).sort(parDate('dBanque')).map(ligneReleve('rl:'));
  const soldeClotureBanque = soldeBanque;
  const releveSuivant = ops.filter((o) => o.dBanque && o.dBanque > fin).sort(parDate('dBanque')).map(ligneReleve('sv:'));

  // --- Rapprochement réel à la clôture ---
  const suspensBanque = ops.filter((o) => o.dCompta && !o.enBanque); // comptabilisé, absent du relevé
  const suspensCompta = ops.filter((o) => o.enBanque && !o.dCompta); // sur le relevé, non comptabilisé
  const ecartsMontant = ops.filter((o) => o.dCompta && o.enBanque && o.mCompta !== o.mBanque);
  const somme = (liste, f) => liste.reduce((s, o) => s + f(o), 0);
  const identite =
    soldeClotureCompta + somme(suspensCompta, (o) => o.signe * o.mBanque) + somme(ecartsMontant, (o) => o.signe * (o.mBanque - o.mCompta)) ===
    soldeClotureBanque + somme(suspensBanque, (o) => o.signe * o.mCompta);
  if (!identite) erreurs.push('Contrôle interne : le rapprochement réel ne boucle pas.');

  // --- État de rapprochement présenté par le client (peut omettre des éléments) ---
  const omis = new Set((brut.rapprochement?.omis || []).map(String));
  for (const id of omis) {
    const o = parId.get(id);
    if (!o) erreurs.push(`rapprochement.omis : opération inconnue « ${id} ».`);
    else if (!suspensBanque.includes(o) && !suspensCompta.includes(o)) erreurs.push(`rapprochement.omis : l'opération ${id} n'est pas un élément de rapprochement à la clôture.`);
  }
  const ligneRappro = (montant, date) => (o) => ({
    ligneId: 'rp:' + o.id, opIds: [o.id], date: o[date], piece: o.piece,
    libelle: date === 'dBanque' ? o.libelleBanque : o.libelle, montant: enEuros(o.signe * o[montant]),
  });
  const coteCompta = suspensCompta.filter((o) => !omis.has(o.id)).sort(parDate('dBanque')).map(ligneRappro('mBanque', 'dBanque'));
  const coteBanque = suspensBanque.filter((o) => !omis.has(o.id)).sort(parDate('dCompta')).map(ligneRappro('mCompta', 'dCompta'));
  const total = (lignes) => lignes.reduce((s, l) => s + enCentimes(l.montant), 0);
  const rectifieCompta = soldeClotureCompta + total(coteCompta);
  const rectifieBanque = soldeClotureBanque + total(coteBanque);
  const ecart = rectifieBanque - rectifieCompta;
  const opsEcart = [...ops.filter((o) => omis.has(o.id)), ...ecartsMontant].map((o) => o.id);
  const libelleEcart = ecart !== 0 && brut.rapprochement?.libelle_ecart ? String(brut.rapprochement.libelle_ecart) : null;

  // --- Anomalies cachées : contrôle de cohérence avec les données ---
  const anomaliesBrutes = Array.isArray(brut.anomalies) ? brut.anomalies : [];
  if (anomaliesBrutes.length < 3 || anomaliesBrutes.length > 5) erreurs.push(`Il faut 3 à 5 anomalies (ici ${anomaliesBrutes.length}).`);
  const couvertes = new Set();
  const anomalies = [];
  anomaliesBrutes.forEach((a, i) => {
    const id = String(a.id || `A${i + 1}`);
    const p = `Anomalie ${id}`;
    if (!TYPES_ANOMALIE[a.type] || a.type === 'autre') { erreurs.push(`${p} : type inconnu « ${a.type} ».`); return; }
    const liste = (Array.isArray(a.operations) ? a.operations : []).map(String);
    const concernees = liste.map((x) => parId.get(x)).filter(Boolean);
    if (!liste.length || concernees.length !== liste.length) { erreurs.push(`${p} : opérations absentes ou inconnues (${liste.join(', ')}).`); return; }
    for (const champ of ['explication', 'procedure', 'correction']) if (!a[champ]) erreurs.push(`${p} : champ « ${champ} » manquant.`);
    const tous = (test, message) => { if (!concernees.every(test)) erreurs.push(`${p} (${a.type}) : ${message}`); };
    let montant = somme(concernees, (o) => o.mCompta ?? o.mBanque);
    let opsLiees = [];
    switch (a.type) {
      case 'cheque_ancien':
        tous((o) => o.sens === 'decaissement' && o.dCompta && !o.enBanque && ecartJours(o.dCompta, fin) >= 365,
          "l'opération doit être un décaissement comptabilisé depuis plus d'un an et absent du relevé.");
        break;
      case 'suspens_ancien':
        tous((o) => o.dCompta && !o.enBanque && ecartJours(o.dCompta, fin) >= 60,
          "l'opération doit être comptabilisée depuis plus de 60 jours et absente du relevé.");
        break;
      case 'virement_non_comptabilise':
        tous((o) => o.sens === 'encaissement' && o.enBanque && !o.dCompta, "l'opération doit être un encaissement présent sur le relevé avec date_compta = null.");
        break;
      case 'frais_non_comptabilises':
        tous((o) => o.sens === 'decaissement' && o.enBanque && !o.dCompta, "l'opération doit être un décaissement présent sur le relevé avec date_compta = null.");
        break;
      case 'double_comptabilisation':
        tous((o) => o.dCompta && !o.dBanque, "ne citer que le doublon : comptabilisé, avec date_banque = null.");
        opsLiees = ops.filter((x) => !concernees.includes(x) && x.dBanque && concernees.some((o) => o.mCompta === x.mCompta && o.sens === x.sens));
        if (!opsLiees.length) erreurs.push(`${p} : aucune opération d'origine de même montant et de même sens n'existe en banque.`);
        break;
      case 'cut_off':
        tous((o) => o.dCompta && o.dBanque && o.dBanque > fin, "l'opération doit être comptabilisée avant la clôture avec une date_banque postérieure à la clôture.");
        break;
      case 'erreur_montant':
        tous((o) => ecartsMontant.includes(o), "l'opération doit avoir montant et montant_banque différents.");
        montant = somme(concernees, (o) => Math.abs(o.mCompta - o.mBanque));
        break;
      case 'rapprochement_faux':
        tous((o) => omis.has(o.id) || ecartsMontant.includes(o), "l'opération doit figurer dans rapprochement.omis ou présenter un écart de montant.");
        montant = Math.abs(ecart);
        break;
      case 'beneficiaire_inhabituel':
        tous((o) => o.sens === 'decaissement' && o.dCompta, "l'opération doit être un décaissement comptabilisé.");
        break;
    }
    concernees.forEach((o) => couvertes.add(o.id));
    anomalies.push({
      id, type: a.type, operations: liste,
      operationsLiees: opsLiees.map((o) => o.id), // lignes dont le signalement vaut aussi détection
      montant: enEuros(montant),
      explication: String(a.explication || ''), procedure: String(a.procedure || ''), correction: String(a.correction || ''),
    });
  });

  // Toute situation anormale dans les données doit être déclarée comme anomalie,
  // sinon la correction serait injuste (fausses alertes à tort).
  for (const o of ops) {
    if (couvertes.has(o.id)) continue;
    if (ecartsMontant.includes(o)) erreurs.push(`Opération ${o.id} : écart de montant compta/banque non déclaré comme anomalie.`);
    else if (suspensCompta.includes(o)) erreurs.push(`Opération ${o.id} : présente sur le relevé mais non comptabilisée, sans anomalie déclarée.`);
    else if (omis.has(o.id)) erreurs.push(`Opération ${o.id} : omise du rapprochement sans anomalie déclarée.`);
    else if (suspensBanque.includes(o) && ecartJours(o.dCompta, fin) > 45) erreurs.push(`Opération ${o.id} : suspens de plus de 45 jours sans anomalie déclarée.`);
  }

  if (erreurs.length) return { cas: null, erreurs };

  const cas = {
    entreprise: {
      nom: ent.nom, secteur: ent.secteur, formeJuridique: ent.forme_juridique,
      effectif: Number(ent.effectif) || 0, contexte: ent.contexte,
    },
    exercice: { debut, fin },
    compteBanque: B,
    ecritures,
    balance,
    etats,
    grandLivre: { soldeOuverture: enEuros(soldeOuvertureCompta), lignes: grandLivre, soldeCloture: enEuros(soldeClotureCompta) },
    releve: { soldeOuverture: enEuros(soldeOuvertureBanque), lignes: lignesReleve, soldeCloture: enEuros(soldeClotureBanque) },
    releveSuivant,
    rapprochement: {
      soldeCompta: enEuros(soldeClotureCompta), soldeBanque: enEuros(soldeClotureBanque),
      coteCompta, coteBanque,
      soldeRectifieCompta: enEuros(rectifieCompta), soldeRectifieBanque: enEuros(rectifieBanque),
      ecart: enEuros(ecart),
      ligneEcart: ecart !== 0 ? { ligneId: 'rp:ecart', opIds: opsEcart, libelle: libelleEcart || 'Écart non justifié', masque: !!libelleEcart, montant: enEuros(ecart) } : null,
    },
    anomalies,
  };
  return { cas, erreurs: [] };
}

/** Résumé chiffré d'un cas, utilisé dans les tests et les messages. */
export function resumerCas(cas) {
  const a = cas.etats.agregats;
  return `${cas.entreprise.nom} — CA ${euro(a.chiffreAffaires)}, résultat ${euro(a.resultatNet)}, total bilan ${euro(a.totalBilan)}, ` +
    `${cas.grandLivre.lignes.length} lignes de grand livre, ${cas.releve.lignes.length} lignes de relevé, ${cas.anomalies.length} anomalies`;
}
