// Déroulé d'une mission en 5 écrans : prise de connaissance, seuil, travaux, synthèse, correction.
import { REFERENTIELS, NIVEAUX, TYPES_ANOMALIE } from './config.js';
import { MOTEURS } from './cycles/index.js';
import { chargerCas } from './generation.js';
import { comparerAnomalies, calculerNote, commenterAvecIA } from './correction.js';
import { lireMission, enregistrerMission, lireParametres } from './storage.js';
import { echapper, euro, dateFr, lireNombre, montantOuVide } from './utils.js';

const ETAPES = ['Prise de connaissance', 'Seuil de signification', 'Travaux', 'Synthèse', 'Correction'];
const BASES = { ca: "Chiffre d'affaires", resultat: 'Résultat net', bilan: 'Total du bilan', capitaux: 'Capitaux propres', autre: 'Autre' };

export async function afficherMission(conteneur, id) {
  const mission = lireMission(id);
  if (!mission) { conteneur.innerHTML = '<div class="carte"><p>Mission introuvable.</p><a href="#/accueil">Retour aux missions</a></div>'; return; }
  let cas;
  try { cas = chargerCas(mission); } catch (e) { conteneur.innerHTML = `<div class="message erreur">${echapper(e.message)}</div>`; return; }
  const ref = REFERENTIELS[mission.referentiel];
  const sauver = () => enregistrerMission(mission);
  const terminee = () => !!mission.correction;
  const t = mission.travail;
  const a = cas.etats.agregats;

  function dessiner() {
    conteneur.innerHTML = `
      <div class="ligne espace">
        <div><h1>${echapper(cas.entreprise.nom)}</h1>
          <p class="discret">Cycle trésorerie · niveau ${NIVEAUX[mission.niveau].libelle} · ${echapper(ref.libelle)} · exercice clos le ${dateFr(cas.exercice.fin)}
          ${mission.source === 'horsligne' ? ' · cas hors-ligne' : ''}${mission.inspireRapport ? ' · inspiré d\'un rapport réel' : ''}</p></div>
      </div>
      <ol class="etapes">${ETAPES.map((nom, i) => `<li><button data-etape="${i + 1}" class="${mission.etape === i + 1 ? 'courante' : ''}">${i + 1}. ${nom}</button></li>`).join('')}</ol>
      <fieldset data-corps ${terminee() && [1, 2, 4].includes(mission.etape) ? 'disabled' : ''}></fieldset>
      <div class="pied">
        <button data-etape="${mission.etape - 1}" ${mission.etape === 1 ? 'hidden' : ''}>← Étape précédente</button><span></span>
        <button class="principal" data-etape="${mission.etape + 1}" ${mission.etape === 5 ? 'hidden' : ''}>Étape suivante →</button>
      </div>`;
    const corps = conteneur.querySelector('[data-corps]');
    [etape1, etape2, etape3, etape4, etape5][mission.etape - 1](corps);
    conteneur.querySelectorAll('[data-etape]').forEach((b) => b.addEventListener('click', () => {
      mission.etape = Math.min(5, Math.max(1, Number(b.dataset.etape)));
      sauver();
      dessiner();
      window.scrollTo(0, 0);
    }));
  }

  /** Relie un champ de saisie à une propriété de la mission (sauvegarde à chaque frappe). */
  function lier(corps, selecteur, objet, cle, apres) {
    const champ = corps.querySelector(selecteur);
    champ.value = objet[cle] ?? '';
    champ.addEventListener('input', () => { objet[cle] = champ.value; sauver(); apres?.(); });
  }

  const blocChiffres = () => `
    <div class="chiffres">
      <div class="chiffre"><span>Chiffre d'affaires</span><strong>${euro(a.chiffreAffaires)}</strong></div>
      <div class="chiffre"><span>Résultat net</span><strong>${euro(a.resultatNet)}</strong></div>
      <div class="chiffre"><span>Total du bilan</span><strong>${euro(a.totalBilan)}</strong></div>
      <div class="chiffre"><span>Capitaux propres</span><strong>${euro(a.capitauxPropres)}</strong></div>
      <div class="chiffre"><span>Banque (${cas.compteBanque}) à la clôture</span><strong>${euro(cas.rapprochement.soldeCompta)}</strong></div>
    </div>`;

  // --- 1. Prise de connaissance ---
  function etape1(corps) {
    const e = cas.entreprise;
    corps.innerHTML = `
      <div class="carte">
        <h2>Fiche entreprise</h2>
        <div class="chiffres">
          <div class="chiffre"><span>Forme juridique</span><strong>${echapper(e.formeJuridique)}</strong></div>
          <div class="chiffre"><span>Effectif</span><strong>${e.effectif} salariés</strong></div>
          <div class="chiffre"><span>Chiffre d'affaires</span><strong>${euro(a.chiffreAffaires)}</strong></div>
        </div>
        <p><strong>Secteur :</strong> ${echapper(e.secteur)}</p>
        <p><strong>Contexte :</strong> ${echapper(e.contexte)}</p>
        <p class="discret">Période examinée pour la trésorerie : du ${dateFr(cas.exercice.debut)} au ${dateFr(cas.exercice.fin)}.</p>
      </div>
      <div class="carte">
        <h2>Risques identifiés</h2>
        <p class="discret">Notez les risques d'anomalies significatives que vous inspire cette prise de connaissance (risque inhérent, contrôle interne, risque de fraude) et leur incidence sur vos travaux de trésorerie.</p>
        <textarea id="risques" style="min-height:10rem" placeholder="Ex. : absence de séparation des fonctions entre…"></textarea>
      </div>`;
    lier(corps, '#risques', t, 'risques');
  }

  // --- 2. Seuil de signification ---
  function etape2(corps) {
    const liste = (lignes) => lignes.map((l) => `<tr><td>${l.compte}</td><td>${echapper(l.libelle)}</td><td class="nombre">${montantOuVide(l.montant) || '0,00'}</td></tr>`).join('');
    const etat = (titre, lignes, total) => `<div><h3>${titre}</h3><div class="defilement"><table><tbody>${liste(lignes)}<tr class="total"><td colspan="2">Total</td><td class="nombre">${montantOuVide(total)}</td></tr></tbody></table></div></div>`;
    const { bilan, resultat } = cas.etats;
    corps.innerHTML = `
      <div class="carte">
        <h2>Données financières (calculées à partir des écritures)</h2>
        ${blocChiffres()}
        <details><summary>Bilan et compte de résultat simplifiés</summary>
          <div class="grille">${etat('Actif', bilan.actif, bilan.totalActif)}${etat('Passif', bilan.passif, bilan.totalPassif)}</div>
          <div class="grille">${etat('Charges', resultat.charges, resultat.totalCharges)}${etat('Produits', resultat.produits, resultat.totalProduits)}</div>
        </details>
        <details><summary>Balance générale</summary>
          <div class="defilement"><table><thead><tr><th>Compte</th><th>Libellé</th><th class="nombre">Débit</th><th class="nombre">Crédit</th><th class="nombre">Solde débiteur</th><th class="nombre">Solde créditeur</th></tr></thead>
          <tbody>${cas.balance.map((l) => `<tr><td>${l.compte}</td><td>${echapper(l.libelle)}</td><td class="nombre">${montantOuVide(l.debit)}</td><td class="nombre">${montantOuVide(l.credit)}</td><td class="nombre">${montantOuVide(l.soldeDebiteur)}</td><td class="nombre">${montantOuVide(l.soldeCrediteur)}</td></tr>`).join('')}</tbody></table></div>
        </details>
      </div>
      <div class="carte">
        <h2>Vos seuils</h2>
        <div class="grille">
          <div><label for="s-base">Base de référence retenue</label><select id="s-base">${Object.entries(BASES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div><label for="s-taux">Taux appliqué (%)</label><input type="text" id="s-taux" inputmode="decimal" placeholder="ex. 1"></div>
          <div><label for="s-signification">Seuil de signification (€)</label><input type="text" id="s-signification" inputmode="decimal"></div>
          <div><label for="s-planification">Seuil de planification (€)</label><input type="text" id="s-planification" inputmode="decimal"></div>
          <div><label for="s-insignifiant">Seuil des anomalies manifestement insignifiantes (€)</label><input type="text" id="s-insignifiant" inputmode="decimal"></div>
        </div>
        <p class="discret" data-controle></p>
        <label for="s-justification">Justification (choix de la base, du taux, des niveaux retenus)</label>
        <textarea id="s-justification" style="min-height:8rem"></textarea>
      </div>`;
    const controle = () => {
      const base = { ca: a.chiffreAffaires, resultat: a.resultatNet, bilan: a.totalBilan, capitaux: a.capitauxPropres }[t.seuil.base];
      const taux = lireNombre(t.seuil.taux);
      const s = lireNombre(t.seuil.signification);
      const morceaux = [];
      if (base && taux) morceaux.push(`${BASES[t.seuil.base]} × ${taux} % = ${euro((base * taux) / 100)}`);
      if (s && lireNombre(t.seuil.planification)) morceaux.push(`planification = ${Math.round((lireNombre(t.seuil.planification) / s) * 100)} % du seuil`);
      if (s && lireNombre(t.seuil.insignifiant)) morceaux.push(`insignifiantes = ${Math.round((lireNombre(t.seuil.insignifiant) / s) * 1000) / 10} % du seuil`);
      corps.querySelector('[data-controle]').textContent = morceaux.length ? 'Aide au calcul : ' + morceaux.join(' · ') : '';
    };
    for (const c of ['base', 'taux', 'signification', 'planification', 'insignifiant', 'justification']) lier(corps, '#s-' + c, t.seuil, c, controle);
    controle();
  }

  // --- 3. Travaux (écran propre au cycle) ---
  async function etape3(corps) {
    const vue = await MOTEURS[mission.cycle].vue();
    vue.afficherTravaux(corps, { mission, cas, sauver, lectureSeule: terminee() });
  }

  // --- 4. Synthèse ---
  function etape4(corps) {
    const seuil = lireNombre(t.seuil.signification);
    const planif = lireNombre(t.seuil.planification);
    const insignifiant = lireNombre(t.seuil.insignifiant);
    const cumul = t.anomalies.reduce((s, x) => s + Math.abs(lireNombre(x.montant)), 0);
    const position = !seuil ? ['moyen', 'Seuil de signification non renseigné (étape 2)']
      : cumul >= seuil ? ['ko', 'Cumul supérieur au seuil de signification']
      : planif && cumul >= planif ? ['moyen', 'Cumul compris entre le seuil de planification et le seuil de signification']
      : ['ok', 'Cumul inférieur au seuil de planification'];
    corps.innerHTML = `
      <div class="carte">
        <h2>Tableau des anomalies relevées</h2>
        <div class="defilement"><table>
          <thead><tr><th>N°</th><th>Type</th><th>Description</th><th>Correction proposée</th><th class="nombre">Montant</th><th>Appréciation</th></tr></thead>
          <tbody>${t.anomalies.map((x, i) => {
            const m = Math.abs(lireNombre(x.montant));
            return `<tr><td>A${i + 1}</td><td>${echapper(TYPES_ANOMALIE[x.type])}</td><td>${echapper(x.nature)}</td><td>${echapper(x.correction)}</td><td class="nombre">${montantOuVide(m)}</td>
              <td>${insignifiant && m < insignifiant ? '<span class="etiquette">Manifestement insignifiante</span>' : seuil && m >= seuil ? '<span class="etiquette ko">Significative à elle seule</span>' : ''}</td></tr>`;
          }).join('') || '<tr><td colspan="6" class="discret">Aucune anomalie déclarée à l\'étape 3.</td></tr>'}
          <tr class="total"><td colspan="4">Cumul des anomalies (valeur absolue)</td><td class="nombre">${montantOuVide(cumul) || '0,00'}</td><td></td></tr></tbody>
        </table></div>
        <div class="chiffres" style="margin-top:.8rem">
          <div class="chiffre"><span>Seuil de signification</span><strong>${euro(seuil)}</strong></div>
          <div class="chiffre"><span>Seuil de planification</span><strong>${euro(planif)}</strong></div>
          <div class="chiffre"><span>Anomalies insignifiantes</span><strong>${euro(insignifiant)}</strong></div>
          <div class="chiffre"><span>Cumul / seuil</span><strong>${seuil ? Math.round((cumul / seuil) * 100) + ' %' : '—'}</strong></div>
        </div>
        <p><span class="etiquette ${position[0]}">${position[1]}</span></p>
      </div>
      <div class="carte">
        <h2>Conclusion sur le cycle trésorerie</h2>
        <p class="discret">Concluez sur l'existence, l'exhaustivité et l'évaluation de la trésorerie : anomalies à corriger, incidence sur l'opinion si elles ne le sont pas, points à remonter à la direction.</p>
        <textarea id="conclusion" style="min-height:11rem"></textarea>
      </div>`;
    lier(corps, '#conclusion', t, 'conclusion');
  }

  // --- 5. Correction ---
  function etape5(corps) {
    if (!mission.correction) {
      corps.innerHTML = `
        <div class="carte">
          <h2>Lancer la correction</h2>
          <p>Vous avez déclaré <strong>${t.anomalies.length}</strong> anomalie(s). Une fois la correction lancée, la mission est clôturée et vos travaux ne sont plus modifiables.</p>
          ${lireParametres().cleGroq ? '' : '<p class="message attention">Aucune clé Groq enregistrée : seule la comparaison automatique sera faite (note provisoire, sans commentaire de l\'IA).</p>'}
          <button class="principal" data-corriger>Corriger ma mission</button>
          <p data-etat class="discret"></p>
        </div>`;
      corps.querySelector('[data-corriger]').addEventListener('click', async (ev) => {
        ev.target.disabled = true;
        const comp = comparerAnomalies(cas, t.anomalies);
        mission.correction = { date: new Date().toISOString(), ia: null, erreurIA: null };
        await demanderIA(comp, corps.querySelector('[data-etat]'));
        dessiner();
      });
      return;
    }
    afficherCorrection(corps);
  }

  async function demanderIA(comp, etat) {
    const parametres = lireParametres();
    if (parametres.cleGroq) {
      if (etat) etat.textContent = "L'IA rédige son appréciation…";
      try {
        mission.correction.ia = await commenterAvecIA({ mission, cas, comp, referentiel: ref, parametres });
        mission.correction.erreurIA = null;
      } catch (e) {
        mission.correction.erreurIA = e.message;
      }
    }
    // Résumé conservé pour l'historique
    const note = calculerNote(comp, mission.correction.ia);
    Object.assign(mission.correction, {
      note: note.note, provisoire: note.provisoire,
      typesTrouves: comp.trouvees.map((x) => x.anomalie.type), typesRates: comp.ratees.map((x) => x.type), nbFaussesAlertes: comp.faussesAlertes.length,
    });
    sauver();
  }

  function afficherCorrection(corps) {
    const comp = comparerAnomalies(cas, t.anomalies);
    const ia = mission.correction.ia;
    const note = calculerNote(comp, ia);
    const d = note.detail;
    const num = (id) => 'A' + (t.anomalies.findIndex((x) => x.id === id) + 1);
    const pts = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
    const corrige = (x) => `<p>${echapper(x.explication)}</p><p class="discret"><strong>Procédure :</strong> ${echapper(x.procedure)}<br><strong>Correction :</strong> ${echapper(x.correction)}</p>`;
    corps.innerHTML = `
      <div class="carte">
        <div class="ligne espace">
          <div><h2>Résultat</h2><div class="note">${pts(note.note)} / 20</div>
            ${note.provisoire ? '<p class="discret">Note provisoire : détection seule, ramenée sur 20 (pas d\'appréciation de l\'IA).</p>' : ''}</div>
          <div class="chiffres" style="flex:1;min-width:260px">
            <div class="chiffre"><span>Trouvées</span><strong>${comp.trouvees.length} / ${comp.total}</strong></div>
            <div class="chiffre"><span>Ratées</span><strong>${comp.ratees.length}</strong></div>
            <div class="chiffre"><span>Fausses alertes</span><strong>${comp.faussesAlertes.length}</strong></div>
          </div>
        </div>
        <details><summary>Détail du barème</summary>
          <ul class="propre">
            <li>Détection des anomalies (−1 par fausse alerte) : ${pts(d.detection)} / 10</li>
            <li>Exactitude des montants : ${pts(d.montants)} / 2</li>
            <li>Qualification (type d'anomalie) : ${pts(d.qualification)} / 2</li>
            ${note.provisoire ? '' : `<li>Seuils (IA) : ${pts(d.seuil)} / 2</li><li>Justifications, procédures et corrections (IA) : ${pts(d.travaux)} / 2</li><li>Conclusion (IA) : ${pts(d.conclusion)} / 2</li>`}
          </ul>
        </details>
      </div>
      <div class="carte">
        <h2>Comparaison avec les anomalies cachées</h2>
        ${comp.trouvees.map((x) => `<div class="bloc-anomalie ok">
          <strong>✔ Trouvée — ${echapper(TYPES_ANOMALIE[x.anomalie.type])} — ${euro(x.anomalie.montant)}</strong>
          <p>Votre saisie : ${x.saisies.map(num).join(', ')}
            <span class="etiquette ${x.typeOk ? 'ok' : 'moyen'}">${x.typeOk ? 'Type exact' : 'Type à revoir'}</span>
            <span class="etiquette ${x.montantOk ? 'ok' : 'moyen'}">${x.montantOk ? 'Montant exact' : 'Montant à revoir'}</span></p>
          ${corrige(x.anomalie)}</div>`).join('')}
        ${comp.ratees.map((x) => `<div class="bloc-anomalie ko"><strong>✘ Ratée — ${echapper(TYPES_ANOMALIE[x.type])} — ${euro(x.montant)}</strong>${corrige(x)}</div>`).join('')}
        ${comp.faussesAlertes.map((x) => `<div class="bloc-anomalie moyen"><strong>Fausse alerte — ${num(x.id)} : ${echapper(TYPES_ANOMALIE[x.type])} (${euro(lireNombre(x.montant))})</strong>
          <p>${echapper(x.nature)}</p><p class="discret">Les lignes signalées ne correspondent à aucune anomalie du cas : ${x.lignes.map((l) => echapper(l.libelle)).join(' · ')}</p></div>`).join('')}
      </div>
      <div class="carte">
        <h2>Appréciation de l'associé (IA, normes ${ref.normes})</h2>
        ${ia ? `
          <p>${echapper(ia.commentaire_general)}</p>
          <h3>Seuils</h3><p>${echapper(ia.seuil?.commentaire)}</p>
          <h3>Justifications, procédures et corrections</h3><p>${echapper(ia.travaux?.commentaire)}</p>
          <h3>Conclusion</h3><p>${echapper(ia.conclusion?.commentaire)}</p>
          <h3>Points à retravailler</h3><ul class="propre">${(Array.isArray(ia.points_a_retravailler) ? ia.points_a_retravailler : []).map((p) => `<li>${echapper(p)}</li>`).join('')}</ul>
          <p class="discret">Commentaire rédigé par une IA : vérifiez les références normatives citées dans les textes officiels.</p>`
        : `<p class="message attention">${echapper(mission.correction.erreurIA || "Pas de commentaire : aucune clé Groq n'était enregistrée lors de la correction.")}</p>
           <button data-relancer>Demander le commentaire de l'IA</button> <span data-etat class="discret"></span>`}
      </div>`;
    corps.querySelector('[data-relancer]')?.addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      await demanderIA(comp, corps.querySelector('[data-etat]'));
      dessiner();
    });
  }

  dessiner();
}
