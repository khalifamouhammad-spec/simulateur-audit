// Point d'entrée : routage par ancre (#/accueil, #/mission/<id>, #/historique, #/parametres).
import { afficherAccueil } from './ui-accueil.js';
import { afficherMission } from './ui-mission.js';
import { afficherHistorique } from './ui-historique.js';
import { afficherParametres } from './ui-parametres.js';

const ROUTES = { accueil: afficherAccueil, mission: afficherMission, historique: afficherHistorique, parametres: afficherParametres };

function router() {
  const [nom, argument] = location.hash.replace(/^#\/?/, '').split('/');
  const route = ROUTES[nom] ? nom : 'accueil';
  // Un conteneur neuf à chaque navigation évite d'empiler les écouteurs d'événements.
  const ancien = document.getElementById('vue');
  const vue = document.createElement('main');
  vue.id = 'vue';
  ancien.replaceWith(vue);
  document.querySelectorAll('.bandeau nav a').forEach((a) => a.classList.toggle('actif', a.dataset.route === (route === 'mission' ? 'accueil' : route)));
  ROUTES[route](vue, argument);
}

window.addEventListener('hashchange', router);
router();
