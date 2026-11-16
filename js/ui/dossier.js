// Dossier ouvert : bandeau client / exercice / statut, arborescence latérale, élément affiché.
import { STRUCTURE_DOSSIER, STATUTS, STATUTS_MISSION, SECTEURS, TAILLES, NIVEAUX, REFERENTIELS, PHASE_COURANTE, trouverElement } from '../config.js';
import { db } from '../db.js';
import { enregistrerDossier, statutElement, avancement, dureeFr } from '../dossiers.js';
import { echapper, dateFr } from '../utils.js';

const pastille = (statut) => `<span class="pastille ${STATUTS[statut].classe}">${STATUTS[statut].libelle}</span>`;

/** Affiche le dossier et renvoie une fonction de fermeture (arrêt du minuteur, sauvegarde). */
export async function afficherDossier(vue, id, code) {
  const dossier = await db.lire('dossiers', id);
  if (!dossier) {
    vue.innerHTML = '<main class="page"><p class="message erreur">Dossier introuvable.</p><a href="#/">Retour au tableau de bord</a></main>';
    return null;
  }
  const element = trouverElement(code);
  const cloturee = dossier.statut === 'cloturee';

  vue.innerHTML = `
    <div class="bandeau-dossier">
      <button class="menu" data-menu aria-label="Afficher l'arborescence">☰</button>
      <div class="client"><strong>${echapper(dossier.client.nom)}</strong><span>${echapper(dossier.client.formeJuridique)} · ${echapper(SECTEURS[dossier.parametres.secteur])} · ${TAILLES[dossier.parametres.taille].libelle}</span></div>
      <div class="info"><span>Exercice</span><strong>${dateFr(dossier.exercice.debut)} – ${dateFr(dossier.exercice.cloture)}</strong></div>
      <div class="info"><span>Mission</span><span class="pastille ${STATUTS_MISSION[dossier.statut].classe}">${STATUTS_MISSION[dossier.statut].libelle}</span></div>
      <div class="info"><span>Avancement</span><strong data-avancement></strong></div>
      <div class="info"><span>Temps passé</span><strong data-temps></strong></div>
    </div>
    <div class="espace-travail">
      <aside class="arborescence" data-arbre></aside>
      <main class="contenu" data-contenu></main>
    </div>`;

  const arbre = vue.querySelector('[data-arbre]');
  const majBandeau = () => {
    vue.querySelector('[data-avancement]').textContent = avancement(dossier) + ' %';
    vue.querySelector('[data-temps]').textContent = dureeFr(dossier.tempsSecondes);
  };
  const dessinerArbre = () => {
    arbre.innerHTML = `
      <a class="noeud racine ${element ? '' : 'actif'}" href="#/dossier/${id}">Synthèse du dossier</a>
      ${STRUCTURE_DOSSIER.map((s) => `
        <details open>
          <summary><b>${s.code === 'X' ? 'FEC' : s.code}</b> ${echapper(s.libelle)}</summary>
          ${s.elements.map((e) => `
            <a class="noeud ${e.code === code ? 'actif' : ''}" href="#/dossier/${id}/${e.code}" title="${echapper(e.libelle)}">
              <i class="point ${e.verrouille && !cloturee ? 'verrou' : STATUTS[statutElement(dossier, e.code)].classe}"></i>
              <span class="code">${e.code}</span><span class="libelle">${echapper(e.libelle)}</span>
            </a>`).join('')}
        </details>`).join('')}`;
  };

  const contenu = vue.querySelector('[data-contenu]');
  // Les saisies sont enregistrées avec un léger différé ; « vider » force l'écriture en attente
  // (appelé à la fermeture de la vue pour ne perdre aucune frappe).
  let attente = null;
  const sauver = async () => { clearTimeout(attente); attente = null; await enregistrerDossier(dossier); dessinerArbre(); majBandeau(); };
  const sauverDiffere = (apres) => { clearTimeout(attente); attente = setTimeout(async () => { await sauver(); apres?.(); }, 400); };
  if (!element) afficherSynthese(contenu, dossier);
  else afficherElement(contenu, dossier, element, sauver, sauverDiffere);
  dessinerArbre();
  majBandeau();
  vue.querySelector('[data-menu]').addEventListener('click', () => arbre.classList.toggle('ouverte'));

  // Temps passé : compté uniquement quand l'onglet est visible, enregistré toutes les 20 secondes.
  let nonEnregistre = 0;
  const minuteur = cloturee ? null : setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    dossier.tempsSecondes++;
    if (++nonEnregistre >= 20) { nonEnregistre = 0; db.ecrire('dossiers', dossier); }
    if (dossier.tempsSecondes % 60 === 0) majBandeau();
  }, 1000);
  return async () => {
    clearInterval(minuteur);
    if (attente) await sauver();
    else if (nonEnregistre) await db.ecrire('dossiers', dossier);
  };
}

function afficherSynthese(contenu, dossier) {
  const p = dossier.parametres;
  contenu.innerHTML = `
    <h1>Synthèse du dossier</h1>
    ${dossier.client.provisoire ? `<p class="message info">Dossier créé avec un nom provisoire. Le scénario du client (rédigé par l'IA) et son FEC seront générés ici à partir de la phase 2.</p>` : ''}
    <div class="indicateurs">
      <div class="indicateur"><span>Secteur</span><strong>${echapper(SECTEURS[p.secteur])}</strong></div>
      <div class="indicateur"><span>Taille</span><strong>${TAILLES[p.taille].libelle}</strong></div>
      <div class="indicateur"><span>Difficulté</span><strong>${NIVEAUX[p.difficulte].libelle}</strong></div>
      <div class="indicateur"><span>Anomalies cachées</span><strong>${p.nbAnomalies}</strong></div>
      <div class="indicateur"><span>Référentiel</span><strong>${echapper(REFERENTIELS[p.referentiel].normes)}</strong></div>
    </div>
    ${p.extraitRapport ? `<div class="panneau"><h2>Extrait de rapport servant de modèle</h2><p class="discret">${echapper(p.extraitRapport)}</p></div>` : ''}
    <div class="panneau">
      <h2>État d'avancement</h2>
      <div class="defilement"><table class="dense">
        <thead><tr><th>Réf.</th><th>Élément</th><th>Section</th><th>Statut</th></tr></thead>
        <tbody>${STRUCTURE_DOSSIER.filter((s) => s.suivi !== false).flatMap((s) => s.elements.map((e) => `
          <tr><td><a href="#/dossier/${dossier.id}/${e.code}">${e.code}</a></td><td>${echapper(e.libelle)}</td><td>${s.code} — ${echapper(s.libelle)}</td><td>${pastille(statutElement(dossier, e.code))}</td></tr>`)).join('')}</tbody>
      </table></div>
    </div>`;
}

function afficherElement(contenu, dossier, element, sauver, sauverDiffere) {
  const section = STRUCTURE_DOSSIER.find((s) => s.code === element.section);
  const cloturee = dossier.statut === 'cloturee';
  const etat = (dossier.elements[element.code] ??= { statut: 'a_faire', notes: '' });
  const disponible = element.phase <= PHASE_COURANTE;
  contenu.innerHTML = `
    <p class="fil">${section.code === 'X' ? 'FEC' : section.code} — ${echapper(section.libelle)}</p>
    <div class="ligne espace">
      <h1><span class="code">${element.code}</span> ${echapper(element.libelle)}</h1>
      ${element.suivi ? `<label class="en-ligne">Statut <select data-statut ${cloturee ? 'disabled' : ''}>${Object.entries(STATUTS).map(([k, s]) => `<option value="${k}" ${etat.statut === k ? 'selected' : ''}>${s.libelle}</option>`).join('')}</select></label>` : ''}
    </div>
    ${element.verrouille && !cloturee ? '<p class="message attention">🔒 Le corrigé reste caché tant que la mission n\'est pas clôturée.</p>' : ''}
    ${disponible ? '' : `<p class="message info">Cet élément sera fonctionnel à la phase ${element.phase} du développement (phase actuelle : ${PHASE_COURANTE}).</p>`}
    <div class="panneau">
      <h2>Contenu prévu</h2>
      <ul>${element.contenu.map((c) => `<li>${echapper(c)}</li>`).join('')}</ul>
    </div>
    ${element.suivi ? `<div class="panneau">
      <h2>Notes de travail</h2>
      <textarea data-notes ${cloturee ? 'disabled' : ''} placeholder="Notes libres sur cet élément du dossier…">${echapper(etat.notes)}</textarea>
      <p class="discret" data-enregistre></p>
    </div>` : ''}`;
  contenu.querySelector('[data-statut]')?.addEventListener('change', (e) => { etat.statut = e.target.value; sauver(); });
  contenu.querySelector('[data-notes]')?.addEventListener('input', (e) => {
    etat.notes = e.target.value;
    if (etat.statut === 'a_faire' && etat.notes.trim()) { etat.statut = 'en_cours'; contenu.querySelector('[data-statut]').value = 'en_cours'; }
    contenu.querySelector('[data-enregistre]').textContent = '';
    sauverDiffere(() => { contenu.querySelector('[data-enregistre]').textContent = 'Enregistré.'; });
  });
}
