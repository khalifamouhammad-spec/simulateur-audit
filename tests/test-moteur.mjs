// Tests du moteur : node tests/test-moteur.mjs
// Génère des cas hors-ligne à tous les niveaux, vérifie la cohérence des chiffres,
// puis vérifie que des cas volontairement faux sont bien rejetés.
import { REFERENTIELS } from '../js/config.js';
import { MOTEURS } from '../js/cycles/index.js';
import { resumerCas } from '../js/cycles/tresorerie.js';
import { comparerAnomalies, calculerNote } from '../js/correction.js';
import { enCentimes } from '../js/utils.js';

const ref = REFERENTIELS.pcg;
const { construireCas, genererCasHorsLigne } = MOTEURS.tresorerie;
let echecs = 0;
const verifier = (condition, message) => {
  if (!condition) { echecs++; console.error('  ÉCHEC : ' + message); }
};
const c = enCentimes;

console.log('--- Génération et contrôle de cohérence ---');
let nb = 0;
for (const niveau of ['debutant', 'intermediaire', 'confirme']) {
  for (let graine = 1; graine <= 200; graine++) {
    const brut = genererCasHorsLigne({ niveau, graine });
    const { cas, erreurs } = construireCas(brut, ref);
    if (!cas) { echecs++; console.error(`  ÉCHEC ${niveau} #${graine} : ${erreurs.join(' | ')}`); continue; }
    nb++;
    if (graine === 1) console.log(`[${niveau}] ${resumerCas(cas)}`);

    // Balance équilibrée et bilan équilibré
    const b = cas.balance;
    verifier(b.reduce((s, l) => s + c(l.debit) - c(l.credit), 0) === 0, 'balance déséquilibrée');
    verifier(c(cas.etats.bilan.totalActif) === c(cas.etats.bilan.totalPassif), 'bilan déséquilibré');
    // Le solde du grand livre banque est celui de la balance
    const banque = b.find((l) => l.compte === '512');
    verifier(c(banque.soldeDebiteur) - c(banque.soldeCrediteur) === c(cas.grandLivre.soldeCloture), 'solde 512 ≠ balance');
    // Soldes progressifs
    let s = c(cas.grandLivre.soldeOuverture);
    for (const l of cas.grandLivre.lignes) { s += c(l.debit) - c(l.credit); verifier(s === c(l.solde), 'solde progressif du grand livre faux'); }
    s = c(cas.releve.soldeOuverture);
    for (const l of cas.releve.lignes) { s += c(l.credit) - c(l.debit); verifier(s === c(l.solde), 'solde progressif du relevé faux'); }
    verifier(s === c(cas.releve.soldeCloture), 'solde final du relevé faux');
    // Rapprochement : l'écart présenté s'explique exactement par les opérations fautives
    const r = cas.rapprochement;
    verifier(c(r.soldeRectifieBanque) - c(r.soldeRectifieCompta) === c(r.ecart), 'écart de rapprochement incohérent');
    verifier((c(r.ecart) !== 0) === cas.anomalies.some((a) => ['rapprochement_faux', 'erreur_montant'].includes(a.type)), 'écart de rapprochement sans anomalie correspondante');
    verifier(cas.anomalies.length >= 3 && cas.anomalies.length <= 5, 'nombre d\'anomalies');
    verifier(cas.anomalies.every((a) => a.montant > 0), 'anomalie de montant nul');
    verifier(cas.grandLivre.lignes.length >= 25, 'grand livre trop court');

    // Correction : une copie parfaite obtient le maximum, une copie vide zéro
    const parfaites = cas.anomalies.map((a) => ({ id: a.id, opIds: a.operations, type: a.type, montant: a.montant }));
    const comp = comparerAnomalies(cas, parfaites);
    verifier(comp.trouvees.length === cas.anomalies.length && !comp.ratees.length && !comp.faussesAlertes.length, 'copie parfaite mal corrigée');
    verifier(calculerNote(comp, null).automatique === 14, 'note automatique d\'une copie parfaite ≠ 14/14');
    const vide = comparerAnomalies(cas, []);
    verifier(vide.ratees.length === cas.anomalies.length && calculerNote(vide, null).automatique === 0, 'copie vide mal corrigée');
  }
}
console.log(`${nb} cas générés et contrôlés.`);

console.log('--- Rejet des cas incohérents ---');
const base = () => genererCasHorsLigne({ niveau: 'intermediaire', graine: 7 });
const doitEtreRejete = (nom, modifier, motif) => {
  const brut = base();
  modifier(brut);
  const { cas, erreurs } = construireCas(brut, ref);
  const ok = !cas && erreurs.some((e) => motif.test(e));
  verifier(ok, `${nom} : non rejeté (${erreurs.join(' | ') || 'aucune erreur'})`);
  if (ok) console.log(`  rejeté comme prévu — ${nom} : ${erreurs.find((e) => motif.test(e))}`);
};
doitEtreRejete('balance d\'ouverture déséquilibrée', (b) => { b.balance_ouverture[0].credit += 1000; }, /déséquilibrée/);
doitEtreRejete('montant négatif', (b) => { b.operations[0].montant = -50; }, /strictement positif/);
doitEtreRejete('anomalie sur opération inconnue', (b) => { b.anomalies[0].operations = ['OP999']; }, /inconnues/);
doitEtreRejete('anomalie non déclarée', (b) => { b.anomalies.pop(); b.anomalies.pop(); }, /3 à 5 anomalies|sans anomalie|non déclaré/);
doitEtreRejete('opération non comptabilisée sans anomalie', (b) => { const o = b.operations.find((x) => x.date_compta && x.date_banque && x.date_banque <= b.exercice.cloture); o.date_compta = null; }, /non comptabilisée/);
doitEtreRejete('type d\'anomalie incohérent avec les données', (b) => { b.anomalies[0].type = b.anomalies[0].type === 'cut_off' ? 'cheque_ancien' : 'cut_off'; }, /cut_off|cheque_ancien/);
doitEtreRejete('trop peu d\'opérations', (b) => { b.operations = b.operations.slice(0, 10); }, /au moins 25|inconnues/);
doitEtreRejete('date invalide', (b) => { b.operations[3].date_compta = '2025-13-45'; }, /date_compta invalide/);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : '\nTous les contrôles sont passés.');
process.exit(echecs ? 1 : 0);
