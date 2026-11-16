// Correction d'une mission.
// 1) Comparaison automatique (code) entre anomalies saisies et anomalies cachées : 14 points.
// 2) Appréciation qualitative par l'IA (seuil, justifications, conclusion) : 6 points.
import { TYPES_ANOMALIE, NIVEAUX } from './config.js';
import { demanderJSON } from './groq.js';
import { euro, lireNombre } from './utils.js';

const proche = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.01);

/**
 * saisies : [{ id, opIds, type, montant, ... }] — anomalies déclarées par l'utilisateur.
 * Une anomalie cachée est « trouvée » si une saisie porte sur l'une de ses opérations.
 */
export function comparerAnomalies(cas, saisies) {
  const trouvees = [];
  const ratees = [];
  const utiles = new Set();
  for (const a of cas.anomalies) {
    const cibles = new Set([...a.operations, ...a.operationsLiees]);
    const liees = saisies.filter((s) => (s.opIds || []).some((id) => cibles.has(id)));
    if (!liees.length) { ratees.push(a); continue; }
    liees.forEach((s) => utiles.add(s.id));
    trouvees.push({
      anomalie: a,
      saisies: liees.map((s) => s.id),
      typeOk: liees.some((s) => s.type === a.type),
      montantOk: liees.some((s) => proche(lireNombre(s.montant), a.montant)),
    });
  }
  return { trouvees, ratees, faussesAlertes: saisies.filter((s) => !utiles.has(s.id)), total: cas.anomalies.length };
}

const borner = (n, max) => Math.min(max, Math.max(0, Number(n) || 0));
const demiPoint = (n) => Math.round(n * 2) / 2;

/** Barème : détection 10, montants 2, qualification 2 (automatique) + seuil 2, travaux 2, conclusion 2 (IA). */
export function calculerNote(comp, ia) {
  const n = comp.total || 1;
  const detail = {
    detection: Math.max(0, (10 * comp.trouvees.length) / n - comp.faussesAlertes.length),
    montants: (2 * comp.trouvees.filter((t) => t.montantOk).length) / n,
    qualification: (2 * comp.trouvees.filter((t) => t.typeOk).length) / n,
  };
  const automatique = detail.detection + detail.montants + detail.qualification;
  if (!ia) return { detail, automatique, note: demiPoint((automatique / 14) * 20), provisoire: true };
  detail.seuil = borner(ia.seuil?.note, 2);
  detail.travaux = borner(ia.travaux?.note, 2);
  detail.conclusion = borner(ia.conclusion?.note, 2);
  return { detail, automatique, note: demiPoint(automatique + detail.seuil + detail.travaux + detail.conclusion), provisoire: false };
}

/** Demande à l'IA son appréciation qualitative. Les notes renvoyées sont bornées par calculerNote. */
export async function commenterAvecIA({ mission, cas, comp, referentiel, parametres }) {
  const t = mission.travail;
  const a = cas.etats.agregats;
  const N = referentiel.normes;
  const decrire = (s) => `- [${TYPES_ANOMALIE[s.type] || s.type}] ${s.nature || '(sans description)'} | montant : ${euro(lireNombre(s.montant))} | procédure : ${s.procedure || '(non renseignée)'} | correction proposée : ${s.correction || '(non renseignée)'}`;
  const parId = new Map(t.anomalies.map((s) => [s.id, s]));
  const cumul = t.anomalies.reduce((s, x) => s + Math.abs(lireNombre(x.montant)), 0);

  const systeme = `Tu es un associé commissaire aux comptes qui corrige le dossier de travail d'un collaborateur junior (cycle trésorerie). Référentiel : ${referentiel.planComptable}, normes ${N}. Tu es exigeant, précis, bienveillant et concret. Tu cites les normes pertinentes par leur numéro (par exemple ${N === 'NEP' ? 'NEP 315, NEP 320, NEP 330, NEP 450, NEP 500, NEP 505, NEP 240, NEP 700' : 'ISA 315, ISA 320, ISA 330, ISA 450, ISA 500, ISA 505, ISA 240, ISA 700'}) uniquement quand elles s'appliquent réellement. Tu ne recalcules pas les chiffres fournis : ils sont exacts. Tu réponds uniquement en JSON valide, en français, en t'adressant au collaborateur avec « vous ».`;

  const utilisateur = `ENTREPRISE AUDITÉE
${cas.entreprise.nom} — ${cas.entreprise.formeJuridique}, ${cas.entreprise.secteur}, ${cas.entreprise.effectif} salariés.
Contexte : ${cas.entreprise.contexte}
Chiffre d'affaires : ${euro(a.chiffreAffaires)} | Résultat net : ${euro(a.resultatNet)} | Total bilan : ${euro(a.totalBilan)} | Capitaux propres : ${euro(a.capitauxPropres)}
Solde comptable de la banque à la clôture : ${euro(cas.rapprochement.soldeCompta)}. Niveau du cas : ${NIVEAUX[mission.niveau].libelle}.

TRAVAIL DU COLLABORATEUR
1. Risques identifiés à la prise de connaissance :
${t.risques || '(rien de saisi)'}

2. Seuils :
Base retenue : ${t.seuil.base} | taux : ${t.seuil.taux || '?'} % | seuil de signification : ${euro(lireNombre(t.seuil.signification))} | seuil de planification : ${euro(lireNombre(t.seuil.planification))} | seuil des anomalies manifestement insignifiantes : ${euro(lireNombre(t.seuil.insignifiant))}
Justification : ${t.seuil.justification || '(rien de saisi)'}

3. Anomalies relevées (cumul en valeur absolue : ${euro(cumul)}) :
${t.anomalies.map(decrire).join('\n') || '(aucune)'}

4. Conclusion sur le cycle :
${t.conclusion || '(rien de saisi)'}

CORRIGÉ (résultat de la comparaison automatique, exact)
Anomalies cachées trouvées :
${comp.trouvees.map((x) => `- ${TYPES_ANOMALIE[x.anomalie.type]} (${euro(x.anomalie.montant)}) : ${x.anomalie.explication} Procédure attendue : ${x.anomalie.procedure} Correction attendue : ${x.anomalie.correction}\n  Saisie du collaborateur : ${x.saisies.map((id) => decrire(parId.get(id))).join(' ; ')}`).join('\n') || '(aucune)'}
Anomalies cachées ratées :
${comp.ratees.map((x) => `- ${TYPES_ANOMALIE[x.type]} (${euro(x.montant)}) : ${x.explication} Procédure qui l'aurait détectée : ${x.procedure}`).join('\n') || '(aucune)'}
Fausses alertes : ${comp.faussesAlertes.length}
Cumul réel des anomalies cachées : ${euro(cas.anomalies.reduce((s, x) => s + x.montant, 0))}

CONSIGNE
Évalue la qualité du raisonnement, pas la détection (déjà notée automatiquement). Réponds avec ce JSON :
{
  "seuil": { "note": 0 à 2, "commentaire": "pertinence de la base, du taux, du seuil de planification et du seuil des anomalies manifestement insignifiantes au regard de ${N} 320 et ${N} 450, cohérence avec le contexte" },
  "travaux": { "note": 0 à 2, "commentaire": "qualité des descriptions, des procédures citées et des écritures de correction proposées ; pertinence des risques identifiés" },
  "conclusion": { "note": 0 à 2, "commentaire": "la conclusion est-elle étayée, cohérente avec le cumul des anomalies et le seuil, et formulée comme attendu dans un dossier d'audit ?" },
  "commentaire_general": "3 à 5 phrases de synthèse",
  "points_a_retravailler": ["3 à 5 points concrets, chacun avec la norme ou la technique à revoir"]
}
Les notes peuvent comporter des demi-points. Une rubrique laissée vide vaut 0.`;

  return demanderJSON({ cle: parametres.cleGroq, modele: parametres.modele, systeme, utilisateur, temperature: 0.3, maxTokens: 2500 });
}
