// Accueil : création d'une mission et reprise des missions en cours.
import { CYCLES, NIVEAUX, REFERENTIELS } from './config.js';
import { genererMissionIA, genererMissionHorsLigne } from './generation.js';
import { lireMissions, enregistrerMission, supprimerMission, lireParametres } from './storage.js';
import { echapper, dateFr } from './utils.js';

export function afficherAccueil(conteneur) {
  const parametres = lireParametres();
  const enCours = lireMissions().filter((m) => !m.correction);
  conteneur.innerHTML = `
    <h1>Missions d'audit</h1>
    <p class="discret">Entraînez-vous comme un collaborateur junior : une entreprise fictive, des données comptables, des anomalies cachées à trouver.</p>
    <div class="carte">
      <h2>Nouvelle mission</h2>
      <div class="grille">
        <div><label for="n-cycle">Cycle</label>
          <select id="n-cycle">${CYCLES.map((c) => `<option value="${c.id}" ${c.disponible ? '' : 'disabled'}>${c.libelle}${c.disponible ? '' : ' (à venir)'}</option>`).join('')}</select></div>
        <div><label for="n-niveau">Niveau de difficulté</label>
          <select id="n-niveau">${Object.values(NIVEAUX).map((n) => `<option value="${n.id}">${n.libelle} — ${n.description}</option>`).join('')}</select></div>
      </div>
      <p class="discret">Référentiel : ${echapper(REFERENTIELS[parametres.referentiel].libelle)} (modifiable dans les Paramètres).</p>
      <details><summary>Option : cas inspiré d'un vrai rapport</summary>
        <label for="n-extrait">Extrait de rapport (par exemple un « point clé de l'audit » d'un rapport de commissaire aux comptes)</label>
        <textarea id="n-extrait" placeholder="Collez ici l'extrait. L'IA s'en inspire pour construire l'entreprise fictive et les anomalies, sans reprendre aucun nom réel."></textarea>
        <p class="discret">L'extrait est envoyé à l'API Groq pour la génération. Nécessite la génération par IA.</p>
      </details>
      <div class="ligne" style="margin-top:.8rem">
        <button class="principal" data-generer="ia">Générer un cas avec l'IA</button>
        <button data-generer="horsligne">Cas hors-ligne (sans IA)</button>
      </div>
      ${parametres.cleGroq ? '' : '<p class="message info">Pour la génération par IA, saisissez votre clé Groq gratuite dans les <a href="#/parametres">Paramètres</a>. Les cas hors-ligne fonctionnent sans clé.</p>'}
      <div data-etat></div>
    </div>
    <div class="carte">
      <h2>Missions en cours</h2>
      ${enCours.length ? `<div class="defilement"><table><thead><tr><th>Créée le</th><th>Entreprise</th><th>Niveau</th><th>Étape</th><th></th></tr></thead><tbody>
        ${enCours.map((m) => `<tr><td class="date">${dateFr(m.creeLe.slice(0, 10))}</td><td>${echapper(m.brut.entreprise?.nom)}</td><td>${NIVEAUX[m.niveau].libelle}</td><td>${m.etape} / 5</td>
          <td><a href="#/mission/${m.id}">Reprendre</a> · <button class="petit danger" data-supprimer="${m.id}">Supprimer</button></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="discret">Aucune mission en cours.</p>'}
    </div>`;

  const etat = conteneur.querySelector('[data-etat]');
  const message = (classe, texte) => { etat.innerHTML = `<p class="message ${classe}">${echapper(texte)}</p>`; };

  conteneur.querySelectorAll('[data-generer]').forEach((bouton) => bouton.addEventListener('click', async () => {
    const options = {
      cycle: conteneur.querySelector('#n-cycle').value,
      niveau: conteneur.querySelector('#n-niveau').value,
      referentiel: parametres.referentiel,
    };
    const boutons = conteneur.querySelectorAll('[data-generer]');
    boutons.forEach((b) => { b.disabled = true; });
    try {
      let mission;
      if (bouton.dataset.generer === 'ia') {
        mission = await genererMissionIA({
          ...options, parametres,
          extraitRapport: conteneur.querySelector('#n-extrait').value.trim(),
          suivi: (texte) => message('info', texte),
        });
      } else {
        mission = genererMissionHorsLigne(options);
      }
      if (!enregistrerMission(mission)) throw new Error('Sauvegarde impossible : stockage du navigateur plein ou désactivé.');
      location.hash = '#/mission/' + mission.id;
    } catch (e) {
      message('erreur', e.message);
      boutons.forEach((b) => { b.disabled = false; });
    }
  }));

  conteneur.querySelectorAll('[data-supprimer]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Supprimer cette mission en cours ?')) return;
    supprimerMission(b.dataset.supprimer);
    afficherAccueil(conteneur);
  }));
}
