// Générateur déterministe de comptabilité : à partir des paramètres du scénario, produit les
// écritures de N-1 puis de N (ventes, achats, paie, immobilisations, emprunt, TVA, clôture),
// injecte les anomalies dans N et renvoie les lignes de FEC. Tous les montants sont en centimes.
import { aleatoire, ajouterJours } from '../utils.js';
import { PLAN, JOURNAUX, TAUX, SECTEURS_MOTEUR, NATURES_EXTERNES, CATEGORIES_IMMO, fabriqueNoms } from './plan.js';
import { BIBLIOTHEQUE } from './anomalies.js';

const ORDRE_JOURNAUX = ['AN', 'VE', 'AC', 'PA', 'BQ', 'OD'];

// ---------- Outils de dates et de répartition ----------
export const iso = (annee, mois, jour) => `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
const jourSemaine = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
export const estWeekEnd = (d) => jourSemaine(d) === 0 || jourSemaine(d) === 6;
/** Décale une date au jour ouvré le plus proche (sens = 1 : après, -1 : avant). */
export function jourOuvre(d, sens = 1) {
  while (estWeekEnd(d)) d = ajouterJours(d, sens);
  return d;
}
const finDeMois = (annee, mois) => iso(annee, mois, new Date(Date.UTC(annee, mois, 0)).getUTCDate());
const gauss = (rnd) => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

/** Répartit un total (centimes) en n montants irréguliers dont la somme est exacte. */
export function repartir(total, n, rnd, dispersion = 0.6) {
  if (n <= 0) return [];
  const poids = Array.from({ length: n }, () => Math.exp(gauss(rnd) * dispersion));
  const somme = poids.reduce((s, p) => s + p, 0);
  const montants = poids.map((p) => Math.max(100, Math.round((total * p) / somme)));
  montants[n - 1] += total - montants.reduce((s, m) => s + m, 0);
  if (montants[n - 1] < 100) montants[n - 1] = 100;
  return montants;
}

/** Ligne d'écriture : compte, débit, crédit, tiers éventuel. */
export const L = (compte, debit, credit, tiers = null) => ({ c: String(compte), d: debit, k: credit, t: tiers, l: '', dl: '' });

// ---------- Livre comptable d'un exercice ----------
export class Livre {
  constructor(annee, utilisateurs) {
    this.annee = annee;
    this.utilisateurs = utilisateurs;
    this.ecritures = [];
    this.uid = 0;
    this.compteurLettre = 0;
    this.compteurs = {};
  }
  /** e : { journal, date, piece, pieceDate, lib, lignes, utilisateur } */
  ajouter(e) {
    e.uid = ++this.uid;
    e.pieceDate ??= e.date;
    e.utilisateur ??= this.utilisateurs[e.journal] || this.utilisateurs.defaut;
    e.lignes = e.lignes.filter((l) => l.d !== 0 || l.k !== 0);
    this.ecritures.push(e);
    return e;
  }
  retirer(e) { this.ecritures = this.ecritures.filter((x) => x !== e); }
  numero(prefixe) { this.compteurs[prefixe] = (this.compteurs[prefixe] || 0) + 1; return `${prefixe}${String(this.compteurs[prefixe]).padStart(5, '0')}`; }
  /** Lettre deux lignes entre elles (même compte auxiliaire). */
  lettrer(ligneA, ligneB, date) {
    let n = this.compteurLettre++;
    let code = '';
    for (let i = 0; i < 3; i++) { code = String.fromCharCode(65 + (n % 26)) + code; n = Math.floor(n / 26); }
    for (const l of [ligneA, ligneB]) { l.l = code; l.dl = date; }
  }
  /** Solde (débit - crédit) par compte, ou par compte + tiers. */
  soldes(parTiers = false) {
    const m = new Map();
    for (const e of this.ecritures) for (const l of e.lignes) {
      const cle = parTiers && l.t ? `${l.c}|${l.t.num}` : l.c;
      m.set(cle, (m.get(cle) || 0) + l.d - l.k);
    }
    return m;
  }
}

// ---------- Paramètres du moteur ----------
/** Dérive tous les paramètres chiffrés à partir du scénario (CA, croissance, taille, secteur). */
export function parametresMoteur(scenario, lignesCible) {
  const cfg = SECTEURS_MOTEUR[scenario.secteur];
  const a = scenario.activite;
  const ca = Math.round(a.chiffreAffaires * 100);
  const nbVentes = Math.round(lignesCible * 0.105);
  const nbAchats = Math.round(lignesCible * 0.085);
  return {
    cfg, secteur: scenario.secteur, ca, croissance: a.croissancePct / 100,
    nbVentes, nbAchats,
    nbClients: Math.max(6, Math.min(a.nbClients, Math.round(nbVentes / 3))),
    nbFournisseurs: Math.max(8, Math.min(a.nbFournisseurs, Math.round(nbAchats / 4))),
    tvaVente: cfg.tvaVente, sansTva: !!cfg.sansTva, sansIs: !!cfg.sansIs,
    seuilAutorisation: ca > 5e9 ? 5000000 : ca > 15e7 ? 500000 : 100000, // seuil de double signature des paiements (centimes)
  };
}

// ---------- Génération d'un exercice ----------
/**
 * ctx : { annee, rnd, P, facteur (activité relative à N), tiers, ouverture, livre, injections, precedent }
 * Renvoie l'état de clôture, qui sert d'ouverture à l'exercice suivant.
 */
function genererExercice(ctx) {
  const { annee, rnd, P, livre, ouverture: O } = ctx;
  const { cfg } = P;
  const ca = Math.round(P.ca * ctx.facteur);
  const tva = (ht, taux) => Math.round(ht * taux);
  const debutAnnee = iso(annee, 1, 1);
  const finAnnee = iso(annee, 12, 31);
  const dernierJourOuvre = jourOuvre(finAnnee, -1);
  const jourAleatoire = (mois) => jourOuvre(iso(annee, mois, rnd.entier(1, 28)));
  const moisAleatoire = () => { // saisonnalité légère : creux en août, pic en fin d'année
    const poids = [8, 8, 9, 9, 9, 9, 8, 5, 9, 9, 9, 10];
    let t = rnd() * 102;
    for (let m = 0; m < 12; m++) { t -= poids[m]; if (t <= 0) return m + 1; }
    return 12;
  };

  // --- À-nouveaux ---
  const an = { journal: 'AN', date: debutAnnee, piece: `AN${annee}`, lib: `À-nouveaux au ${iso(annee, 1, 1).split('-').reverse().join('/')}`, lignes: [] };
  for (const [compte, solde] of O.soldes) if (solde) an.lignes.push(L(compte, solde > 0 ? solde : 0, solde < 0 ? -solde : 0));
  const postesOuverts = [];
  for (const p of O.postes) { // créances et dettes non soldées, détaillées par pièce
    const ligne = L(p.compte, p.montant > 0 ? p.montant : 0, p.montant < 0 ? -p.montant : 0, p.tiers);
    an.lignes.push(ligne);
    postesOuverts.push({ ...p, ligne });
  }
  livre.ajouter(an);
  an.lignesParPiece = postesOuverts;

  // --- Règlement des postes ouverts à l'ouverture ---
  for (const p of postesOuverts) {
    if (p.bloque) continue; // poste volontairement non réglé (anomalie de l'exercice précédent ou en cours)
    const date = jourOuvre(p.echeance < debutAnnee ? ajouterJours(debutAnnee, rnd.entier(3, 25)) : p.echeance);
    if (date > finAnnee) continue;
    const m = Math.abs(p.montant);
    const client = p.montant > 0;
    const e = livre.ajouter({ journal: 'BQ', date, piece: livre.numero(client ? 'ENC' : 'VIR'), lib: `${client ? 'Encaissement' : 'Règlement'} ${p.piece} ${p.tiers.nom}`,
      lignes: client ? [L('512000', m, 0), L(p.compte, 0, m, p.tiers)] : [L(p.compte, m, 0, p.tiers), L('512000', 0, m)] });
    livre.lettrer(p.ligne, e.lignes[client ? 1 : 0], date);
    p.regle = true;
  }

  // --- Dettes d'ouverture payées en début d'exercice ---
  const payer = (compte, date, lib) => {
    const du = -(O.soldes.get(compte) || 0);
    if (du > 0) livre.ajouter({ journal: 'BQ', date: jourOuvre(date), piece: livre.numero('PRLV'), lib, lignes: [L(compte, du, 0), L('512000', 0, du)] });
  };
  payer('431000', iso(annee, 1, 15), `URSSAF cotisations 12/${annee - 1}`);
  payer('445510', iso(annee, 1, 20), `TVA à décaisser 12/${annee - 1}`);
  payer('444000', iso(annee, 5, 15), `Solde impôt sur les sociétés ${annee - 1}`);

  // --- Extournes d'ouverture : factures non parvenues et congés payés ---
  for (const f of O.fnp) {
    const e = livre.ajouter({ journal: 'OD', date: debutAnnee, piece: `EXT-FNP-${annee}`, lib: `Extourne FNP ${f.lib} ${f.fournisseur.nom}`,
      lignes: [L('408100', f.ht + f.tva, 0, f.fournisseur), L(f.compte, 0, f.ht), L('445860', 0, f.tva)] });
    const poste = postesOuverts.find((p) => p.fnp && !p.ligne.l && p.tiers === f.fournisseur && p.montant === -(f.ht + f.tva));
    if (poste) livre.lettrer(poste.ligne, e.lignes[0], debutAnnee);
  }
  if (O.cp.brut) {
    livre.ajouter({ journal: 'OD', date: debutAnnee, piece: `EXT-CP-${annee}`, lib: `Extourne provision congés payés ${annee - 1}`,
      lignes: [L('428200', O.cp.brut, 0), L('641200', 0, O.cp.brut), L('438200', O.cp.charges, 0), L('645800', 0, O.cp.charges)] });
  }
  // --- Affectation du résultat N-1 ---
  const resultatAnterieur = -(O.soldes.get('120000') || 0) - (O.soldes.get('129000') || 0);
  if (resultatAnterieur > 0) livre.ajouter({ journal: 'OD', date: jourOuvre(iso(annee, 6, 28)), piece: `AG-${annee}`, lib: `Affectation du résultat ${annee - 1} (AG d'approbation)`, lignes: [L('120000', resultatAnterieur, 0), L(P.sansIs ? '110000' : '106800', 0, resultatAnterieur)] });
  else if (resultatAnterieur < 0) livre.ajouter({ journal: 'OD', date: jourOuvre(iso(annee, 6, 28)), piece: `AG-${annee}`, lib: `Affectation du résultat ${annee - 1} (AG d'approbation)`, lignes: [L('119000', -resultatAnterieur, 0), L('129000', 0, -resultatAnterieur)] });

  // --- Ventes ---
  const ventes = [];
  /** Crée une facture de vente et, si l'échéance tombe dans l'exercice, son encaissement. */
  const vendre = ({ client, ht, date, lib, sansReglement = false, utilisateur, pieceDate }) => {
    const t = P.sansTva ? 0 : tva(ht, P.tvaVente);
    const piece = livre.numero(`FA${annee}-`);
    const e = livre.ajouter({ journal: 'VE', date, piece, pieceDate, utilisateur, lib: lib || `Facture ${piece} ${client.nom}`,
      lignes: [L('411000', ht + t, 0, client), L(cfg.vente, 0, ht), L('445710', 0, t)] });
    const v = { e, client, ht, tva: t, ttc: ht + t, piece, date, reglement: null, echeance: jourOuvre(ajouterJours(date, Math.max(0, client.delai + rnd.entier(-3, 12)))) };
    ventes.push(v);
    if (!sansReglement) reglerVente(v);
    return v;
  };
  const reglerVente = (v) => {
    if (v.echeance > finAnnee) return;
    v.reglement = livre.ajouter({ journal: 'BQ', date: v.echeance, piece: livre.numero(v.client.delai <= 2 ? 'CB' : 'ENC'), lib: `Encaissement ${v.piece} ${v.client.nom}`,
      lignes: [L('512000', v.ttc, 0), L('411000', 0, v.ttc, v.client)] });
    livre.lettrer(v.e.lignes[0], v.reglement.lignes[1], v.echeance);
  };
  const caFacture = Math.round(ca * (1 - (cfg.subventions || 0)));
  const nbVentes = Math.max(40, Math.round(P.nbVentes * Math.sqrt(ctx.facteur)));
  const poidsClients = ctx.tiers.clients.map((_, i) => 1 / (i + 1) ** 0.8);
  const totalPoids = poidsClients.reduce((s, p) => s + p, 0);
  const clientAleatoire = () => { let t = rnd() * totalPoids; for (let i = 0; i < poidsClients.length; i++) { t -= poidsClients[i]; if (t <= 0) return ctx.tiers.clients[i]; } return ctx.tiers.clients[0]; };
  for (const ht of repartir(caFacture, nbVentes, rnd)) vendre({ client: clientAleatoire(), ht, date: jourAleatoire(moisAleatoire()) });
  if (cfg.subventions) { // associations : subventions versées par trimestre
    for (const [i, m] of repartir(ca - caFacture, 4, rnd, 0.15).entries()) {
      livre.ajouter({ journal: 'BQ', date: jourOuvre(iso(annee, i * 3 + 2, 12)), piece: livre.numero('ENC'), lib: `Subvention de fonctionnement T${i + 1} ${annee}`, lignes: [L('512000', m, 0), L('740000', 0, m)] });
    }
  }

  // --- Achats ---
  const achats = [];
  const acheter = ({ fournisseur, ht, date, compte, lib, sansReglement = false, piece, utilisateur, taxable = fournisseur.taxable }) => {
    const t = P.sansTva || !taxable ? 0 : tva(ht, TAUX.tvaNormale);
    const charge = P.sansTva && taxable ? ht + tva(ht, TAUX.tvaNormale) : ht; // TVA non récupérable : incluse dans la charge
    piece ??= `${fournisseur.num.slice(1)}-${rnd.entier(10000, 99999)}`;
    const e = livre.ajouter({ journal: 'AC', date, piece, utilisateur, lib: lib || `${fournisseur.libFacture} ${fournisseur.nom}`,
      lignes: [L(compte || fournisseur.compteCharge, charge, 0), L('445660', t, 0), L('401000', 0, charge + t, fournisseur)] });
    const a = { e, fournisseur, ht: charge, tva: t, ttc: charge + t, piece, date, reglement: null, echeance: jourOuvre(ajouterJours(date, fournisseur.delai + rnd.entier(0, 8))) };
    achats.push(a);
    if (!sansReglement) reglerAchat(a);
    return a;
  };
  const reglerAchat = (a) => {
    if (a.echeance > finAnnee) return;
    const cheque = a.fournisseur.mode === 'cheque';
    a.reglement = livre.ajouter({ journal: 'BQ', date: a.echeance, piece: livre.numero(cheque ? 'CHQ' : 'VIR'), lib: `${cheque ? 'Chèque' : 'Virement'} ${a.fournisseur.nom} ${a.piece}`,
      lignes: [L('401000', a.ttc, 0, a.fournisseur), L('512000', 0, a.ttc)] });
    livre.lettrer(a.e.lignes[a.e.lignes.length - 1], a.reglement.lignes[0], a.echeance);
  };
  // Factures de janvier correspondant aux FNP de l'exercice précédent
  for (const f of O.fnp) acheter({ fournisseur: f.fournisseur, ht: f.ht, date: jourOuvre(iso(annee, 1, rnd.entier(5, 20))), compte: f.compte, lib: `${f.lib} ${f.fournisseur.nom} (12/${annee - 1})`, taxable: f.tva > 0 });

  const fournisseursPar = (compte) => ctx.tiers.fournisseurs.filter((f) => f.compteCharge === compte);
  let resteFactures = Math.max(40, Math.round(P.nbAchats * Math.sqrt(ctx.facteur)));
  const budgetExternes = Math.round(ca * cfg.externes);
  for (const nature of NATURES_EXTERNES) {
    const budget = Math.round(budgetExternes * nature.part);
    const fs = fournisseursPar(nature.compte);
    const n = nature.frequence || Math.max(4, Math.round(P.nbAchats * 0.04));
    resteFactures -= n;
    repartir(budget, n, rnd, nature.frequence ? 0.05 : 0.5).forEach((ht, i) => {
      const date = nature.frequence ? jourOuvre(iso(annee, Math.floor((i * 12) / n) + 1, rnd.entier(2, 8))) : jourAleatoire(moisAleatoire());
      acheter({ fournisseur: fs[i % fs.length], ht, date });
    });
  }
  const principaux = [[cfg.achat, cfg.achats], ['611000', cfg.sousTraitance]].filter(([, part]) => part > 0);
  const partTotale = principaux.reduce((s, [, p]) => s + p, 0);
  let achatsStockes = 0;
  for (const [compte, part] of principaux) {
    const fs = fournisseursPar(compte);
    const n = Math.max(20, Math.round((resteFactures * part) / partTotale));
    for (const ht of repartir(Math.round(ca * part), n, rnd)) acheter({ fournisseur: rnd.choix(fs), ht, date: jourAleatoire(moisAleatoire()) });
    if (compte === cfg.achat) achatsStockes = Math.round(ca * part);
  }

  // --- Paie ---
  const brutAnnuel = Math.round((ca * cfg.personnel) / (1 + TAUX.cotisationsPatronales));
  const paies = [];
  repartir(brutAnnuel, 12, rnd, 0.03).forEach((brut, i) => {
    const mois = i + 1;
    const date = jourOuvre(finDeMois(annee, mois), -1);
    const salariales = Math.round(brut * TAUX.cotisationsSalariales);
    const patronales = Math.round(brut * TAUX.cotisationsPatronales);
    const periode = `${String(mois).padStart(2, '0')}/${annee}`;
    const e = livre.ajouter({ journal: 'PA', date, piece: `PAIE-${periode}`, lib: `Paie ${periode}`,
      lignes: [L('641100', brut, 0), L('431000', 0, salariales), L('421000', 0, brut - salariales), L('645100', patronales, 0), L('431000', 0, patronales)] });
    livre.ajouter({ journal: 'BQ', date, piece: livre.numero('VIR'), lib: `Virement salaires ${periode}`, lignes: [L('421000', brut - salariales, 0), L('512000', 0, brut - salariales)] });
    paies.push({ e, mois, brut, salariales, patronales });
  });
  // L'URSSAF du mois est prélevée le 15 du mois suivant (calculée après les anomalies, voir plus bas).

  // --- Emprunt, frais bancaires, investissements ---
  const immos = O.immos.map((x) => ({ ...x }));
  let capitalRestant = O.emprunt.capitalRestant;
  for (let mois = 1; mois <= 12 && capitalRestant > 0; mois++) {
    const capital = Math.min(capitalRestant, O.emprunt.mensualite);
    const interets = Math.round((capitalRestant * O.emprunt.taux) / 12);
    livre.ajouter({ journal: 'BQ', date: jourOuvre(iso(annee, mois, 5)), piece: livre.numero('PRLV'), lib: `Échéance emprunt ${String(mois).padStart(2, '0')}/${annee}`,
      lignes: [L('164000', capital, 0), L('661160', interets, 0), L('512000', 0, capital + interets)] });
    capitalRestant -= capital;
  }
  for (let mois = 1; mois <= 12; mois++) {
    const frais = Math.round(ca * 0.00012 * (0.8 + rnd() * 0.4));
    livre.ajouter({ journal: 'BQ', date: jourOuvre(iso(annee, mois, 3)), piece: livre.numero('PRLV'), lib: `Frais et commissions bancaires ${String(mois).padStart(2, '0')}/${annee}`, lignes: [L('627000', frais, 0), L('512000', 0, frais)] });
  }
  /** Acquisition d'immobilisation : facture au journal des achats (fournisseur d'immobilisations) puis règlement. */
  const investir = ({ categorie, ht, date, lib, utilisateur }) => {
    const t = P.sansTva ? 0 : tva(ht, TAUX.tvaNormale);
    const brut = P.sansTva ? ht + tva(ht, TAUX.tvaNormale) : ht;
    const f = ctx.tiers.fournisseurImmo;
    const piece = `${f.num.slice(1)}-${rnd.entier(10000, 99999)}`;
    const e = livre.ajouter({ journal: 'AC', date, piece, utilisateur, lib: `${lib} ${f.nom}`, lignes: [L(categorie.compte, brut, 0), L('445620', t, 0), L('404000', 0, brut + t, f)] });
    const echeance = jourOuvre(ajouterJours(date, 30));
    if (echeance <= finAnnee) {
      const r = livre.ajouter({ journal: 'BQ', date: echeance, piece: livre.numero('VIR'), lib: `Virement ${f.nom} ${piece}`, lignes: [L('404000', brut + t, 0, f), L('512000', 0, brut + t)] });
      livre.lettrer(e.lignes[e.lignes.length - 1], r.lignes[0], echeance);
    }
    const immo = { id: `${annee}-${e.uid}`, compte: categorie.compte, amort: categorie.amort, lib, brut, cumul: 0, duree: categorie.duree, dateAcquisition: date };
    immos.push(immo);
    return { e, immo };
  };
  for (let i = 0, n = rnd.entier(1, 3); i < n; i++) {
    const categorie = rnd.choix(CATEGORIES_IMMO);
    investir({ categorie, ht: Math.round(ca * cfg.immo * categorie.part * (0.05 + rnd() * 0.1)), date: jourAleatoire(rnd.entier(2, 10)), lib: `Acquisition ${categorie.lib.toLowerCase()}` });
  }

  // --- Injection des anomalies portant sur les opérations (exercice N uniquement) ---
  const cloture = { fnpOubliees: 0, cpFacteur: 1, amortOublie: null, stockErreur: 0, tauxIs: TAUX.is };
  const donnees = { banque: { nonComptabilises: [], chequesNonDebites: [] }, posterieur: { avoirs: [], factures: [], faits: [] }, inventaire: null };
  const outils = { annee, rnd, P, cfg, ca, livre, ventes, achats, paies, immos, tiers: ctx.tiers, cloture, donnees, precedent: ctx.precedent,
    vendre, acheter, investir, finAnnee, dernierJourOuvre, jourAleatoire, echelle: ctx.echelle,
    L, iso, repartir, jourOuvre, difficulte: ctx.difficulte,
    annulerReglement(op) { // rend une facture impayée : supprime le règlement et le lettrage
      if (!op.reglement) return;
      livre.retirer(op.reglement);
      op.reglement = null;
      for (const l of op.e.lignes) { l.l = ''; l.dl = ''; }
    },
  };
  const enAttente = [];
  for (const injection of ctx.injections || []) {
    const resultat = injection.definition.injecter(outils, injection);
    if (resultat) enAttente.push({ injection, resultat });
    else injection.echec = true;
  }

  // --- URSSAF : prélèvement le 15 du mois suivant, d'après les écritures de paie réellement passées ---
  for (const p of paies.slice(0, 11)) {
    const du = p.e.lignes.filter((l) => l.c === '431000').reduce((s, l) => s + l.k, 0);
    livre.ajouter({ journal: 'BQ', date: jourOuvre(iso(annee, p.mois + 1, 15)), piece: livre.numero('PRLV'), lib: `URSSAF cotisations ${String(p.mois).padStart(2, '0')}/${annee}`, lignes: [L('431000', du, 0), L('512000', 0, du)] });
  }

  // --- TVA : liquidation mensuelle d'après les écritures, paiement le 20 du mois suivant ---
  if (!P.sansTva) {
    let credit = O.soldes.get('445670') || 0;
    for (let mois = 1; mois <= 12; mois++) {
      const prefixe = iso(annee, mois, 1).slice(0, 7);
      let collectee = 0; let deductible = 0; let surImmos = 0;
      for (const e of livre.ecritures) {
        if (!e.date.startsWith(prefixe) || e.journal === 'AN') continue;
        for (const l of e.lignes) {
          if (l.c === '445710') collectee += l.k - l.d;
          else if (l.c === '445660') deductible += l.d - l.k;
          else if (l.c === '445620') surImmos += l.d - l.k;
        }
      }
      const net = collectee - deductible - surImmos - credit;
      const date = jourOuvre(finDeMois(annee, mois), -1);
      const periode = `${String(mois).padStart(2, '0')}/${annee}`;
      livre.ajouter({ journal: 'OD', date, piece: `CA3-${periode}`, lib: `Déclaration de TVA ${periode}`,
        lignes: [L('445710', Math.max(collectee, 0), Math.max(-collectee, 0)), L('445660', 0, deductible), L('445620', 0, surImmos), L('445670', net < 0 ? -net - credit : 0, net >= 0 ? credit : 0), L('445510', 0, Math.max(net, 0))]
          .map((l) => (l.d < 0 ? L(l.c, 0, -l.d) : l.k < 0 ? L(l.c, -l.k, 0) : l)) });
      credit = net < 0 ? -net : 0;
      if (net > 0 && mois < 12) livre.ajouter({ journal: 'BQ', date: jourOuvre(iso(annee, mois + 1, 20)), piece: livre.numero('PRLV'), lib: `TVA à décaisser ${periode}`, lignes: [L('445510', net, 0), L('512000', 0, net)] });
    }
  }

  // --- Écritures de clôture ---
  const OD = (piece, lib, lignes, utilisateur = livre.utilisateurs.cloture) => livre.ajouter({ journal: 'OD', date: finAnnee, piece, lib, lignes, utilisateur });
  // Amortissements
  const dotations = new Map();
  for (const x of immos) {
    const prorata = x.dateAcquisition >= debutAnnee ? (360 - (Number(x.dateAcquisition.slice(5, 7)) - 1) * 30 - Math.min(30, Number(x.dateAcquisition.slice(8, 10))) + 1) / 360 : 1;
    x.dotation = Math.max(0, Math.min(x.brut - x.cumul, Math.round((x.brut / x.duree) * prorata)));
    if (cloture.amortOublie === x.amort) { x.dotationOubliee = x.dotation; continue; }
    x.cumul += x.dotation;
    dotations.set(x.amort, (dotations.get(x.amort) || 0) + x.dotation);
  }
  const totalDotations = [...dotations.values()].reduce((s, v) => s + v, 0);
  const odAmort = totalDotations ? OD(`DOT-${annee}`, `Dotations aux amortissements ${annee}`, [L('681120', totalDotations, 0), ...[...dotations].map(([compte, m]) => L(compte, 0, m))]) : null;
  // Stocks
  let stockFinal = 0; let odStock = null;
  if (cfg.stock) {
    const stockReel = Math.round(((achatsStockes * cfg.joursStock) / 365) * (0.9 + rnd() * 0.2));
    stockFinal = stockReel + cloture.stockErreur;
    const initial = O.soldes.get(cfg.stock) || 0;
    if (initial) OD(`STK-${annee}-1`, `Annulation du stock initial`, [L(cfg.varStock, initial, 0), L(cfg.stock, 0, initial)]);
    odStock = OD(`STK-${annee}-2`, `Constatation du stock final (inventaire du ${dernierJourOuvre.split('-').reverse().join('/')})`, [L(cfg.stock, stockFinal, 0), L(cfg.varStock, 0, stockFinal)]);
    donnees.inventaire = { stockComptabilise: stockFinal, stockReel };
  }
  // Factures non parvenues : prestations de décembre facturées en janvier
  const fnp = [];
  const externesVariables = ctx.tiers.fournisseurs.filter((f) => ['622600', '615000', '624100', '611000', '623000'].includes(f.compteCharge));
  const nouvelleFnp = (ht, oubliee) => {
    const fournisseur = rnd.choix(externesVariables);
    const t = P.sansTva || !fournisseur.taxable ? 0 : tva(ht, TAUX.tvaNormale);
    const item = { fournisseur, compte: fournisseur.compteCharge, ht: P.sansTva ? ht + tva(ht, TAUX.tvaNormale) : ht, tva: t, lib: fournisseur.libFacture };
    donnees.posterieur.factures.push({ fournisseur: fournisseur.nom, date: iso(annee + 1, 1, rnd.entier(6, 24)), ht: item.ht, tva: t, lib: `${item.lib} — prestation de décembre ${annee}`, provisionnee: !oubliee });
    return item;
  };
  for (const ht of repartir(Math.round(budgetExternes * 0.03), rnd.entier(3, 5), rnd, 0.4)) {
    const f = nouvelleFnp(ht, false);
    f.e = OD(`FNP-${annee}`, `FNP ${f.lib} ${f.fournisseur.nom}`, [L(f.compte, f.ht, 0), L('445860', f.tva, 0), L('408100', 0, f.ht + f.tva, f.fournisseur)]);
    Object.assign(f.e, { fnp: true, bloque: true });
    fnp.push(f);
  }
  const fnpOubliees = cloture.fnpOubliees ? repartir(cloture.fnpOubliees, 2, rnd, 0.3).map((ht) => nouvelleFnp(ht, true)) : [];
  // Congés payés
  const cpComplet = Math.round(brutAnnuel / 12);
  const cp = { brut: Math.round(cpComplet * cloture.cpFacteur) };
  cp.charges = Math.round(cp.brut * TAUX.cotisationsPatronales);
  cp.complet = cpComplet + Math.round(cpComplet * TAUX.cotisationsPatronales);
  const odCp = OD(`CP-${annee}`, `Provision pour congés payés au 31/12/${annee}`, [L('641200', cp.brut, 0), L('428200', 0, cp.brut), L('645800', cp.charges, 0), L('438200', 0, cp.charges)]);
  // Impôt sur les sociétés
  const resultatAvantIs = () => { let r = 0; for (const [compte, solde] of livre.soldes()) if (compte[0] === '6' || compte[0] === '7') r -= solde; return r; };
  const avantIs = resultatAvantIs();
  let odIs = null;
  const isDu = P.sansIs || avantIs <= 0 ? 0 : Math.round(avantIs * TAUX.is);
  if (isDu) {
    const comptabilise = Math.round(avantIs * cloture.tauxIs);
    odIs = OD(`IS-${annee}`, `Impôt sur les sociétés ${annee}`, [L('695000', comptabilise, 0), L('444000', 0, comptabilise)]);
  }

  // --- Les anomalies dont le chiffrage dépend de la clôture se finalisent ici ---
  const contexteCloture = { odAmort, odStock, odCp, odIs, fnp, fnpOubliees, cp, immos, stockFinal, avantIs, isDu };
  const anomalies = enAttente.map(({ injection, resultat }) => {
    const r = typeof resultat === 'function' ? resultat(contexteCloture) : resultat;
    if (!r) { injection.echec = true; return null; }
    return { ...r, type: injection.type, indice: injection.indice || '' };
  }).filter(Boolean);

  // --- Trésorerie : pas de découvert. Si le solde passe en négatif, apport en début d'exercice. ---
  const mouvements = livre.ecritures.flatMap((e) => e.lignes.filter((l) => l.c === '512000').map((l) => [e.date, l.d - l.k])).sort((a, b) => a[0].localeCompare(b[0]));
  let solde = 0; let minimum = 0;
  for (const [, m] of mouvements) { solde += m; if (solde < minimum) minimum = solde; }
  if (minimum < 0) {
    const besoin = Math.ceil((-minimum * 1.15) / 100000) * 100000;
    if (ctx.premierExercice) { // l'ouverture de N-1 est construite : on renforce banque et réserves
      const ajouterAuSolde = (compte, sens) => { const l = an.lignes.find((x) => x.c === compte && !x.t); if (l) { if (sens > 0) l.d += besoin; else l.k += besoin; } else an.lignes.push(sens > 0 ? L(compte, besoin, 0) : L(compte, 0, besoin)); };
      ajouterAuSolde('512000', 1);
      ajouterAuSolde(P.sansIs ? '110000' : '106800', -1);
    } else {
      livre.ajouter({ journal: 'BQ', date: jourOuvre(iso(annee, 1, 2)), piece: livre.numero('ENC'), lib: `Apport en compte courant d'associé`, lignes: [L('512000', besoin, 0), L('455000', 0, besoin)] });
    }
  }

  // --- État de clôture (ouverture de l'exercice suivant) ---
  const soldesFin = new Map();
  let resultat = 0;
  const postes = [];
  for (const [cle, s] of livre.soldes(true)) {
    const [compte] = cle.split('|');
    if (compte[0] === '6' || compte[0] === '7') { resultat -= s; continue; }
    if (cle.includes('|')) continue; // comptes de tiers : repris en détail ci-dessous
    if (s) soldesFin.set(compte, s);
  }
  soldesFin.set(resultat >= 0 ? '120000' : '129000', -resultat);
  // Postes non lettrés des comptes de tiers, détaillés par pièce
  for (const e of livre.ecritures) for (const l of e.lignes) {
    if (!l.t || l.l) continue;
    const origine = e.journal === 'AN' ? e.lignesParPiece.find((p) => p.ligne === l) : null;
    postes.push({ compte: l.c, tiers: l.t, montant: l.d - l.k, piece: origine ? origine.piece : e.piece, date: origine ? origine.date : e.date,
      echeance: origine ? origine.echeance : jourOuvre(ajouterJours(e.date, l.t.delai + rnd.entier(0, 10))), bloque: origine?.bloque || e.bloque || false, fnp: origine?.fnp || e.fnp || false });
  }
  return {
    etat: { soldes: soldesFin, postes, immos, emprunt: { ...O.emprunt, capitalRestant }, fnp, cp, },
    anomalies, donnees, resultat, ventes, achats,
  };
}

// ---------- Ouverture du premier exercice ----------
function construireOuverture(P, tiers, annee, rnd) {
  const { cfg } = P;
  const ca = Math.round(P.ca / (1 + P.croissance) / (1 + P.croissance * 0.5)); // activité de l'exercice N-2
  const soldes = new Map();
  const poser = (compte, montant) => { if (montant) soldes.set(compte, (soldes.get(compte) || 0) + montant); };
  const immos = CATEGORIES_IMMO.map((c, i) => {
    const brut = Math.round((ca * cfg.immo * c.part) / 100000) * 100000 || 100000;
    const cumul = Math.round((brut * c.age) / c.duree);
    poser(c.compte, brut);
    poser(c.amort, -cumul);
    return { id: `OUV-${i}`, compte: c.compte, amort: c.amort, lib: c.lib, brut, cumul, duree: c.duree, dateAcquisition: iso(annee - c.age, 1, 1) };
  });
  const capitalEmprunt = Math.round((ca * 0.06) / 100000) * 100000;
  poser('164000', -capitalEmprunt);
  if (cfg.stock) poser(cfg.stock, Math.round((ca * cfg.achats * cfg.joursStock) / 365));
  const brutMensuel = Math.round((ca * cfg.personnel) / (1 + TAUX.cotisationsPatronales) / 12);
  poser('431000', -Math.round(brutMensuel * (TAUX.cotisationsSalariales + TAUX.cotisationsPatronales)));
  const cp = { brut: brutMensuel, charges: Math.round(brutMensuel * TAUX.cotisationsPatronales) };
  poser('428200', -cp.brut);
  poser('438200', -cp.charges);
  if (!P.sansTva) poser('445510', -Math.max(0, Math.round((ca * (P.tvaVente - (cfg.achats + cfg.sousTraitance + cfg.externes * 0.9) * TAUX.tvaNormale)) / 12)));
  if (!P.sansIs) poser('444000', -Math.round(ca * 0.04 * TAUX.is));
  poser('512000', Math.round(ca * 0.08));

  // Créances et dettes ouvertes, détaillées par pièce
  const postes = [];
  const debut = iso(annee, 1, 1);
  const nbClients = Math.max(5, Math.round((P.nbVentes * 40) / 365));
  for (const ht of repartir(Math.round((ca * (1 - (cfg.subventions || 0)) * 40) / 365), nbClients, rnd)) {
    const client = rnd.choix(tiers.clients);
    const date = jourOuvre(iso(annee - 1, rnd.entier(11, 12), rnd.entier(1, 28)));
    postes.push({ compte: '411000', tiers: client, montant: ht + (P.sansTva ? 0 : Math.round(ht * P.tvaVente)), piece: `FA${annee - 1}-${String(9000 + postes.length).padStart(5, '0')}`, date, echeance: ajouterJours(date, client.delai + rnd.entier(0, 12)) });
  }
  const nbFournisseurs = Math.max(5, Math.round((P.nbAchats * 35) / 365));
  const principaux = tiers.fournisseurs.filter((f) => [cfg.achat, '611000'].includes(f.compteCharge));
  for (const ttc of repartir(Math.round((ca * (cfg.achats + cfg.sousTraitance + cfg.externes) * 1.15 * 35) / 365), nbFournisseurs, rnd)) {
    const f = rnd.choix(principaux);
    const date = jourOuvre(iso(annee - 1, 12, rnd.entier(1, 28)));
    postes.push({ compte: '401000', tiers: f, montant: -ttc, piece: `${f.num.slice(1)}-${rnd.entier(10000, 99999)}`, date, echeance: ajouterJours(date, f.delai + rnd.entier(0, 8)) });
  }
  // Factures non parvenues d'ouverture
  const externes = tiers.fournisseurs.filter((f) => ['622600', '615000'].includes(f.compteCharge));
  const fnp = repartir(Math.round(ca * cfg.externes * 0.03), 3, rnd, 0.4).map((ht) => {
    const fournisseur = rnd.choix(externes);
    const t = P.sansTva ? 0 : Math.round(ht * TAUX.tvaNormale);
    const charge = P.sansTva ? ht + Math.round(ht * TAUX.tvaNormale) : ht;
    poser('408100', 0); // le compte 408 est repris par tiers ci-dessous
    postes.push({ compte: '408100', tiers: fournisseur, montant: -(charge + t), piece: `FNP-${annee - 1}`, date: iso(annee - 1, 12, 31), echeance: debut, bloque: true, fnp: true });
    poser('445860', t);
    return { fournisseur, compte: fournisseur.compteCharge, ht: charge, tva: t, lib: fournisseur.libFacture };
  });
  // Capital, puis réserves calculées pour équilibrer
  const capital = Math.max(1000000, Math.round((ca * 0.05) / 1000000) * 1000000);
  poser(P.sansIs ? '102000' : '101300', -capital);
  let ecart = [...soldes.values()].reduce((s, v) => s + v, 0) + postes.reduce((s, p) => s + p.montant, 0);
  if (ecart < Math.round(ca * 0.02)) { const apport = Math.round(ca * 0.02) - ecart; poser('512000', apport); ecart += apport; }
  poser(P.sansIs ? '110000' : '106800', -ecart);
  return { soldes, postes, immos, emprunt: { capitalRestant: capitalEmprunt, taux: 0.035, mensualite: Math.round(capitalEmprunt / 60) }, fnp, cp };
}

// ---------- Tiers ----------
function construireTiers(scenario, P, rnd) {
  const { cfg } = P;
  const nom = fabriqueNoms(rnd, [scenario.client.nom]);
  const clients = [];
  const nomsClients = [...(scenario.clientsPrincipaux || [])];
  for (let i = 0; i < P.nbClients; i++) {
    clients.push({ num: 'C' + String(i + 1).padStart(4, '0'), nom: nomsClients[i] || nom(), compte: '411000', delai: rnd.choix(cfg.delais) });
  }
  if (P.secteur === 'restauration') Object.assign(clients[0], { nom: 'Clients comptoir (ventes du jour)', delai: 1 });
  const fournisseurs = [];
  const ajouter = (compteCharge, libFacture, n, noms = [], taxable = true) => {
    for (let i = 0; i < n; i++) {
      fournisseurs.push({ num: 'F' + String(fournisseurs.length + 1).padStart(4, '0'), nom: noms[i] || nom(), compte: '401000', compteCharge, libFacture, taxable,
        delai: rnd.choix([30, 30, 45]), mode: rnd() < 0.3 ? 'cheque' : 'virement' });
    }
  };
  const nbPrincipaux = Math.max(4, P.nbFournisseurs - 20);
  const libAchat = { 607000: 'Achat de marchandises', 601000: 'Achat de matières premières', 604000: 'Prestation de services' }[cfg.achat];
  ajouter(cfg.achat, libAchat, cfg.sousTraitance ? Math.ceil(nbPrincipaux * 0.65) : nbPrincipaux, scenario.fournisseursPrincipaux || []);
  if (cfg.sousTraitance) ajouter('611000', 'Sous-traitance chantier', Math.max(3, Math.floor(nbPrincipaux * 0.35)));
  for (const n of NATURES_EXTERNES) ajouter(n.compte, n.lib, n.frequence ? 1 : Math.min(n.noms.length, 2), rnd.melanger(n.noms), n.tva);
  const fournisseurImmo = { num: 'F9001', nom: 'Équipements & Matériels Pro', compte: '404000', delai: 30, mode: 'virement', taxable: true };
  return { clients, fournisseurs, fournisseurImmo };
}

// ---------- Conversion en lignes de FEC ----------
function versLignesFec(livre) {
  const rang = (j) => ORDRE_JOURNAUX.indexOf(j);
  const tri = [...livre.ecritures].sort((a, b) => (a.journal === 'AN' ? -1 : b.journal === 'AN' ? 1 : 0) || a.date.localeCompare(b.date) || rang(a.journal) - rang(b.journal) || a.uid - b.uid);
  const compteurs = {};
  const lignes = [];
  for (const e of tri) {
    compteurs[e.journal] = (compteurs[e.journal] || 0) + 1;
    e.num = `${e.journal}${String(compteurs[e.journal]).padStart(6, '0')}`;
    const mois = e.date.slice(0, 7);
    const validation = e.journal === 'AN' ? e.date : iso(Number(mois.slice(0, 4)), Number(mois.slice(5)), new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5)), 0)).getUTCDate());
    for (const l of e.lignes) {
      lignes.push([e.journal, JOURNAUX[e.journal], e.num, e.date, l.c, PLAN[l.c] || '', l.t ? l.t.num : '', l.t ? l.t.nom : '',
        e.piece, e.pieceDate, e.lib, l.d / 100, l.k / 100, l.l, l.dl, validation, '', '',
        e.utilisateur, e.dateSaisie || e.date]);
    }
  }
  return lignes;
}

// ---------- Point d'entrée ----------
/**
 * scenario : { secteur, taille, difficulte, graine, client, activite, clientsPrincipaux, fournisseursPrincipaux }
 * choix    : [{ type, indice }] — anomalies retenues (bibliothèque)
 * Renvoie { fec: { 'N-1': lignes, N: lignes }, anomalies, donnees, tiers, exercices }
 */
export function genererComptabilite(scenario, choix, { lignesCible, annee }) {
  const rnd = aleatoire(scenario.graine);
  const P = parametresMoteur(scenario, lignesCible);
  const tiers = construireTiers(scenario, P, rnd);
  const utilisateurs = { defaut: 'COMPTA1', VE: P.nbVentes > 400 ? 'COMPTA2' : 'COMPTA1', PA: 'PAIE', AN: 'EXPERT', cloture: 'EXPERT', inhabituel: rnd.choix(['DG', 'STAGIAIRE', 'ADMIN']) };

  // Exercice N-1 (sans anomalie)
  const livre1 = new Livre(annee - 1, utilisateurs);
  const ex1 = genererExercice({ annee: annee - 1, rnd, P, facteur: 1 / (1 + P.croissance), tiers, livre: livre1, ouverture: construireOuverture(P, tiers, annee - 1, rnd), premierExercice: true });
  const fec1 = versLignesFec(livre1);

  // Exercice N (avec anomalies)
  const partEchelle = { debutant: 0.02, intermediaire: 0.01, confirme: 0.005 }[scenario.difficulte];
  const injections = choix.map((c) => ({ ...c, definition: BIBLIOTHEQUE[c.type], echelle: Math.round(P.ca * partEchelle * (0.7 + rnd() * 0.6)) }));
  const livre = new Livre(annee, utilisateurs);
  const ex = genererExercice({ annee, rnd, P, facteur: 1, tiers, livre, difficulte: scenario.difficulte, ouverture: ex1.etat, injections, precedent: { livre: livre1, achats: ex1.achats }, echelle: Math.round(P.ca * partEchelle) });
  const fec = versLignesFec(livre);

  const ref = (e) => ({ exercice: e.uid && livre1.ecritures.includes(e) ? 'N-1' : 'N', num: e.num, journal: e.journal });
  const anomalies = ex.anomalies.map((a, i) => {
    const d = BIBLIOTHEQUE[a.type];
    return {
      id: `AN-${String(i + 1).padStart(2, '0')}`, type: a.type, libelle: d.libelle, cycle: d.cycle, assertion: d.assertion, fraude: !!d.fraude,
      ecritures: (a.ecritures || []).filter(Boolean).map(ref), comptes: a.comptes || [],
      montant: a.montant / 100, impactResultat: a.impactResultat / 100,
      explication: a.explication, procedure: d.procedure, correction: a.correction, indice: a.indice,
    };
  });
  return {
    fec: { 'N-1': fec1, N: fec }, anomalies, donnees: ex.donnees,
    echecs: injections.filter((i) => i.echec).map((i) => i.type),
    tiers: { clients: tiers.clients.map(({ num, nom, delai }) => ({ num, nom, delai })), fournisseurs: tiers.fournisseurs.map(({ num, nom, compteCharge, mode }) => ({ num, nom, compteCharge, mode })) },
    utilisateurs, seuilAutorisation: P.seuilAutorisation / 100,
  };
}
