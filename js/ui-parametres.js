// Paramètres : clé Groq (stockée uniquement dans ce navigateur), modèle, référentiel.
import { REFERENTIELS, MODELE_GROQ_DEFAUT } from './config.js';
import { listerModeles } from './groq.js';
import { lireParametres, ecrireParametres } from './storage.js';
import { echapper } from './utils.js';

export function afficherParametres(conteneur) {
  const p = lireParametres();
  conteneur.innerHTML = `
    <h1>Paramètres</h1>
    <div class="carte">
      <h2>IA — API Groq</h2>
      <p class="discret">Créez une clé gratuite sur <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a> puis collez-la ici.
      Elle est enregistrée uniquement dans ce navigateur (localStorage) et n'est envoyée qu'à l'API Groq. Elle n'est jamais écrite dans le code.</p>
      <label for="p-cle">Clé API Groq</label>
      <input type="password" id="p-cle" autocomplete="off" placeholder="gsk_…" value="${echapper(p.cleGroq)}">
      <label for="p-modele">Modèle</label>
      <input type="text" id="p-modele" list="p-modeles" value="${echapper(p.modele)}">
      <datalist id="p-modeles"><option value="${MODELE_GROQ_DEFAUT}"></datalist>
      <p class="discret">Modèle par défaut : ${MODELE_GROQ_DEFAUT}. « Tester la connexion » charge la liste des modèles disponibles avec votre clé.</p>
      <div class="ligne"><button class="principal" data-enregistrer>Enregistrer</button><button data-tester>Tester la connexion</button><button class="danger" data-effacer>Effacer la clé</button></div>
      <div data-etat></div>
    </div>
    <div class="carte">
      <h2>Référentiel</h2>
      <label for="p-ref">Plan comptable et normes d'audit</label>
      <select id="p-ref">${Object.values(REFERENTIELS).map((r) => `<option value="${r.id}" ${r.disponible ? '' : 'disabled'} ${p.referentiel === r.id ? 'selected' : ''}>${echapper(r.libelle)}</option>`).join('')}</select>
      <p class="discret">Le référentiel SYSCOHADA révisé / ISA (zone OHADA) est prévu dans l'architecture et sera activé dans une prochaine version.</p>
    </div>`;

  const etat = conteneur.querySelector('[data-etat]');
  const message = (classe, texte) => { etat.innerHTML = `<p class="message ${classe}">${echapper(texte)}</p>`; };
  const lireFormulaire = () => ({
    cleGroq: conteneur.querySelector('#p-cle').value.trim(),
    modele: conteneur.querySelector('#p-modele').value.trim() || MODELE_GROQ_DEFAUT,
    referentiel: conteneur.querySelector('#p-ref').value,
  });
  const enregistrer = () => (ecrireParametres(lireFormulaire()) ? message('succes', 'Paramètres enregistrés dans ce navigateur.') : message('erreur', 'Enregistrement impossible (stockage du navigateur désactivé).'));

  conteneur.querySelector('[data-enregistrer]').addEventListener('click', enregistrer);
  conteneur.querySelector('#p-ref').addEventListener('change', enregistrer);
  conteneur.querySelector('[data-effacer]').addEventListener('click', () => {
    conteneur.querySelector('#p-cle').value = '';
    enregistrer();
  });
  conteneur.querySelector('[data-tester]').addEventListener('click', async () => {
    message('info', 'Test en cours…');
    try {
      const modeles = await listerModeles(lireFormulaire().cleGroq);
      conteneur.querySelector('#p-modeles').innerHTML = modeles.map((m) => `<option value="${echapper(m)}">`).join('');
      ecrireParametres(lireFormulaire());
      const connu = modeles.includes(lireFormulaire().modele);
      message(connu ? 'succes' : 'attention', connu
        ? `Connexion réussie : ${modeles.length} modèles disponibles. Clé enregistrée.`
        : `Connexion réussie, mais le modèle « ${lireFormulaire().modele} » n'est pas dans la liste : choisissez-en un autre dans le champ Modèle.`);
    } catch (e) {
      message('erreur', e.message);
    }
  });
}
