// Historique des missions corrigées et repérage des points faibles.
import { NIVEAUX, TYPES_ANOMALIE } from './config.js';
import { lireMissions, supprimerMission } from './storage.js';
import { echapper, dateFr } from './utils.js';

const fr = (n) => String(n).replace('.', ',');

export function afficherHistorique(conteneur) {
  const faites = lireMissions().filter((m) => m.correction);
  if (!faites.length) {
    conteneur.innerHTML = '<h1>Historique</h1><div class="carte"><p class="discret">Aucune mission corrigée pour l\'instant. <a href="#/accueil">Lancer une mission</a>.</p></div>';
    return;
  }
  // Points faibles : par type d'anomalie, nombre de fois ratée / rencontrée.
  const stats = {};
  for (const m of faites) {
    for (const type of m.correction.typesTrouves || []) (stats[type] ??= { vues: 0, ratees: 0 }).vues++;
    for (const type of m.correction.typesRates || []) { (stats[type] ??= { vues: 0, ratees: 0 }).vues++; stats[type].ratees++; }
  }
  const classement = Object.entries(stats).sort((x, y) => y[1].ratees / y[1].vues - x[1].ratees / x[1].vues || y[1].ratees - x[1].ratees);
  const moyenne = faites.reduce((s, m) => s + (m.correction.note || 0), 0) / faites.length;

  conteneur.innerHTML = `
    <h1>Historique</h1>
    <div class="carte">
      <div class="chiffres">
        <div class="chiffre"><span>Missions corrigées</span><strong>${faites.length}</strong></div>
        <div class="chiffre"><span>Note moyenne</span><strong>${fr(Math.round(moyenne * 10) / 10)} / 20</strong></div>
      </div>
      <h3>Points faibles par type d'anomalie</h3>
      <div class="defilement"><table><thead><tr><th>Type d'anomalie</th><th class="nombre">Rencontrée</th><th class="nombre">Ratée</th><th>Taux d'échec</th></tr></thead><tbody>
        ${classement.map(([type, s]) => {
          const taux = Math.round((s.ratees / s.vues) * 100);
          return `<tr><td>${echapper(TYPES_ANOMALIE[type] || type)}</td><td class="nombre">${s.vues}</td><td class="nombre">${s.ratees}</td>
            <td><span class="etiquette ${taux >= 50 ? 'ko' : taux > 0 ? 'moyen' : 'ok'}">${taux} %</span></td></tr>`;
        }).join('')}
      </tbody></table></div>
    </div>
    <div class="carte">
      <h2>Cas réalisés</h2>
      <div class="defilement"><table><thead><tr><th>Date</th><th>Entreprise</th><th>Cycle</th><th>Niveau</th><th class="nombre">Note</th><th>Anomalies ratées</th><th></th></tr></thead><tbody>
        ${faites.map((m) => `<tr>
          <td class="date">${dateFr(m.correction.date.slice(0, 10))}</td><td>${echapper(m.brut.entreprise?.nom)}</td><td>Trésorerie</td><td>${NIVEAUX[m.niveau].libelle}</td>
          <td class="nombre">${fr(m.correction.note)} / 20${m.correction.provisoire ? ' *' : ''}</td>
          <td>${(m.correction.typesRates || []).map((x) => `<span class="etiquette ko">${echapper(TYPES_ANOMALIE[x] || x)}</span>`).join(' ') || '<span class="etiquette ok">Aucune</span>'}
            ${m.correction.nbFaussesAlertes ? `<span class="etiquette moyen">${m.correction.nbFaussesAlertes} fausse(s) alerte(s)</span>` : ''}</td>
          <td><a href="#/mission/${m.id}">Revoir</a> · <button class="petit danger" data-supprimer="${m.id}">Supprimer</button></td></tr>`).join('')}
      </tbody></table></div>
      <p class="discret">* Note provisoire : correction sans appréciation de l'IA.</p>
    </div>`;
  conteneur.querySelectorAll('[data-supprimer]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Supprimer définitivement cette mission de l\'historique ?')) return;
    supprimerMission(b.dataset.supprimer);
    afficherHistorique(conteneur);
  }));
}
