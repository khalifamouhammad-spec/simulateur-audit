// Écran « Travaux » du cycle trésorerie : grand livre, relevé, rapprochement, relevé N+1,
// sélection de lignes et déclaration d'anomalies.
import { TYPES_ANOMALIE } from '../config.js';
import { creerTableau } from '../tableau.js';
import { echapper, euro, dateFr, montantOuVide, identifiant, lireNombre } from '../utils.js';

export function afficherTravaux(conteneur, { mission, cas, sauver, lectureSeule }) {
  const anomalies = mission.travail.anomalies;
  const cochees = new Map(); // ligneId -> { ligneId, opIds, libelle }
  let onglet = 'gl';

  const numero = (a) => 'A' + (anomalies.indexOf(a) + 1);
  const etiquette = (ligne) => anomalies.filter((a) => a.lignes.some((l) => l.ligneId === ligne.ligneId)).map(numero).join(' ');
  const selectionPour = (source, decrire) => ({
    actif: !lectureSeule,
    contient: (l) => cochees.has(l.ligneId),
    etiquette,
    basculer: (l, coche) => {
      if (coche) cochees.set(l.ligneId, { ligneId: l.ligneId, opIds: l.opIds, libelle: `${source} — ${decrire(l)}` });
      else cochees.delete(l.ligneId);
      majBarre();
    },
  });
  const decrireMouvement = (l) => `${dateFr(l.date)} ${l.libelle} (${euro(l.debit || l.credit)})`;
  const ligneSolde = (titre, montant, nbCol) => `<tr class="total"><td colspan="${nbCol}">${titre}</td><td class="nombre">${montantOuVide(montant) || '0,00'}</td></tr>`;

  conteneur.innerHTML = `
    <div class="carte">
      <h2>Travaux sur le cycle trésorerie</h2>
      <p class="discret">Pointez le grand livre avec le relevé, contrôlez l'état de rapprochement et son apurement sur le relevé de janvier.
      Cochez les lignes qui vous semblent anormales, puis déclarez l'anomalie. Sur le relevé, un débit est une sortie d'argent et un crédit une entrée (point de vue de la banque).</p>
      <div class="onglets" role="tablist"></div>
      <div data-contenu></div>
      <div class="barre-selection" hidden>
        <span data-nb></span>
        <span class="ligne"><button data-action="vider">Tout décocher</button><button class="principal" data-action="declarer">Déclarer une anomalie</button></span>
      </div>
    </div>
    <dialog></dialog>`;
  const zone = conteneur.querySelector('[data-contenu]');
  const barre = conteneur.querySelector('.barre-selection');
  const dialogue = conteneur.querySelector('dialog');

  const ONGLETS = [
    ['gl', `Grand livre ${cas.compteBanque}`],
    ['releve', 'Relevé bancaire'],
    ['rappro', 'État de rapprochement'],
    ['suivant', 'Relevé de janvier N+1'],
    ['anomalies', () => `Mes anomalies (${anomalies.length})`],
  ];

  function majOnglets() {
    conteneur.querySelector('.onglets').innerHTML = ONGLETS.map(([id, t]) =>
      `<button role="tab" data-onglet="${id}" class="${id === onglet ? 'actif' : ''}">${typeof t === 'function' ? t() : t}</button>`).join('');
  }
  function majBarre() {
    barre.hidden = cochees.size === 0;
    barre.querySelector('[data-nb]').textContent = `${cochees.size} ligne(s) cochée(s)`;
  }

  function dessiner() {
    majOnglets();
    zone.innerHTML = '';
    if (onglet === 'gl') {
      zone.append(creerTableau({
        lignes: cas.grandLivre.lignes,
        colonnes: [
          { cle: 'date', titre: 'Date', type: 'date' }, { cle: 'piece', titre: 'Pièce' }, { cle: 'libelle', titre: 'Libellé' },
          { cle: 'contrepartie', titre: 'Contrepartie' }, { cle: 'debit', titre: 'Débit', type: 'montant' },
          { cle: 'credit', titre: 'Crédit', type: 'montant' }, { cle: 'solde', titre: 'Solde', type: 'montant' },
        ],
        selection: selectionPour('Grand livre', decrireMouvement),
        entete: ligneSolde(`Solde au ${dateFr(cas.exercice.debut)} (à nouveau)`, cas.grandLivre.soldeOuverture, 7),
        pied: ligneSolde(`Solde au ${dateFr(cas.exercice.fin)}`, cas.grandLivre.soldeCloture, 7),
      }));
    } else if (onglet === 'releve' || onglet === 'suivant') {
      const suivant = onglet === 'suivant';
      const lignes = suivant ? cas.releveSuivant : cas.releve.lignes;
      if (suivant) zone.insertAdjacentHTML('beforeend', '<p class="discret">Mouvements passés en banque après la clôture : ils permettent de vérifier l\'apurement des suspens du rapprochement.</p>');
      zone.append(creerTableau({
        lignes,
        colonnes: [
          { cle: 'date', titre: 'Date', type: 'date' }, { cle: 'libelle', titre: 'Libellé' },
          { cle: 'debit', titre: 'Débit', type: 'montant' }, { cle: 'credit', titre: 'Crédit', type: 'montant' }, { cle: 'solde', titre: 'Solde', type: 'montant' },
        ],
        selection: selectionPour(suivant ? 'Relevé N+1' : 'Relevé', decrireMouvement),
        entete: ligneSolde(suivant ? `Solde au ${dateFr(cas.exercice.fin)}` : 'Ancien solde', suivant ? cas.releve.soldeCloture : cas.releve.soldeOuverture, 5),
        pied: suivant ? '' : ligneSolde(`Nouveau solde au ${dateFr(cas.exercice.fin)}`, cas.releve.soldeCloture, 5),
      }));
    } else if (onglet === 'rappro') dessinerRapprochement();
    else dessinerAnomalies();
  }

  function dessinerRapprochement() {
    const r = cas.rapprochement;
    const masque = r.ligneEcart?.masque;
    const ligne = (l) => {
      const coche = cochees.has(l.ligneId);
      const etiq = etiquette(l);
      return `<tr data-id="${l.ligneId}" class="${coche ? 'cochee' : etiq ? 'declaree' : ''}">
        <td class="case"><input type="checkbox" ${coche ? 'checked' : ''} ${lectureSeule ? 'disabled' : ''} aria-label="Cocher la ligne">${etiq ? `<br><span class="etiquette">${etiq}</span>` : ''}</td>
        <td class="date">${dateFr(l.date)}</td><td>${echapper(l.piece || '')}</td><td>${echapper(l.libelle)}</td><td class="nombre">${montantOuVide(l.montant)}</td></tr>`;
    };
    const total = (titre, m) => `<tr class="total"><td colspan="4">${titre}</td><td class="nombre">${montantOuVide(m) || '0,00'}</td></tr>`;
    const tableau = (titre, soldeTitre, solde, lignes, rectifie, vide) => `
      <h3>${titre}</h3>
      <div class="defilement"><table><thead><tr><th></th><th>Date</th><th>Pièce</th><th>Libellé</th><th class="nombre">Montant</th></tr></thead><tbody>
        ${total(soldeTitre, solde)}
        ${lignes.map(ligne).join('') || `<tr><td colspan="5" class="discret">${vide}</td></tr>`}
        ${total('Solde rectifié', rectifie)}
      </tbody></table></div>`;
    const lignesCompta = masque ? [...r.coteCompta, r.ligneEcart] : r.coteCompta;
    const rectifieCompta = masque ? r.soldeRectifieBanque : r.soldeRectifieCompta;
    const ecartAffiche = masque ? 0 : r.ecart;
    zone.innerHTML = `
      <p class="discret">État de rapprochement bancaire établi par le client au ${dateFr(cas.exercice.fin)}. Montants positifs : à ajouter ; négatifs : à déduire.</p>
      ${tableau('Côté comptabilité — opérations du relevé à comptabiliser', `Solde du compte ${cas.compteBanque} au ${dateFr(cas.exercice.fin)}`, r.soldeCompta, lignesCompta, rectifieCompta, 'Aucun élément.')}
      ${tableau('Côté banque — opérations comptabilisées non encore passées en banque', `Solde du relevé au ${dateFr(cas.exercice.fin)}`, r.soldeBanque, r.coteBanque, r.soldeRectifieBanque, 'Aucun élément.')}
      <div class="defilement" style="margin-top:.8rem"><table><tbody>
        ${ecartAffiche !== 0 ? ligne({ ...r.ligneEcart, date: '', piece: '', libelle: 'Écart entre les deux soldes rectifiés (non justifié par le client)' })
          : total('Écart entre les deux soldes rectifiés', 0)}
      </tbody></table></div>`;
    const toutes = [...r.coteCompta, ...r.coteBanque, ...(r.ligneEcart ? [r.ligneEcart] : [])];
    zone.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', () => {
      const l = toutes.find((x) => x.ligneId === c.closest('tr').dataset.id);
      if (c.checked) cochees.set(l.ligneId, { ligneId: l.ligneId, opIds: l.opIds, libelle: `Rapprochement — ${dateFr(l.date)} ${l.libelle} (${euro(l.montant)})` });
      else cochees.delete(l.ligneId);
      majBarre();
      dessinerRapprochement();
    }));
  }

  function dessinerAnomalies() {
    if (!anomalies.length) {
      zone.innerHTML = '<p class="discret">Aucune anomalie déclarée. Cochez des lignes dans les autres onglets puis cliquez sur « Déclarer une anomalie ».</p>';
      return;
    }
    zone.innerHTML = anomalies.map((a) => `
      <div class="bloc-anomalie">
        <div class="ligne espace"><strong>${numero(a)} — ${echapper(TYPES_ANOMALIE[a.type])} — ${euro(lireNombre(a.montant))}</strong>
          ${lectureSeule ? '' : `<span class="ligne"><button class="petit" data-modifier="${a.id}">Modifier</button><button class="petit danger" data-supprimer="${a.id}">Supprimer</button></span>`}</div>
        <p>${echapper(a.nature) || '<span class="discret">Pas de description</span>'}</p>
        <p class="discret">Lignes : ${a.lignes.map((l) => echapper(l.libelle)).join(' · ')}</p>
        <p class="discret">Procédure : ${echapper(a.procedure) || '—'}<br>Correction : ${echapper(a.correction) || '—'}</p>
      </div>`).join('');
  }

  function ouvrirFormulaire(existante) {
    const a = existante || { id: identifiant(), lignes: [...cochees.values()], type: '', nature: '', montant: '', procedure: '', correction: '' };
    dialogue.innerHTML = `
      <form method="dialog">
        <h2>${existante ? 'Modifier' : 'Déclarer'} une anomalie</h2>
        <p class="discret">Lignes concernées :</p>
        <ul class="propre discret">${a.lignes.map((l) => `<li>${echapper(l.libelle)}</li>`).join('')}</ul>
        <label for="a-type">Type d'anomalie</label>
        <select id="a-type" required><option value="">— Choisir —</option>${Object.entries(TYPES_ANOMALIE).map(([k, v]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${echapper(v)}</option>`).join('')}</select>
        <label for="a-nature">Nature de l'anomalie et impact sur les comptes</label>
        <textarea id="a-nature" required>${echapper(a.nature)}</textarea>
        <label for="a-montant">Montant de l'anomalie (€)</label>
        <input type="text" id="a-montant" inputmode="decimal" value="${echapper(a.montant)}" placeholder="1 234,56" required>
        <label for="a-procedure">Procédure d'audit utilisée</label>
        <textarea id="a-procedure">${echapper(a.procedure)}</textarea>
        <label for="a-correction">Écriture de correction proposée</label>
        <textarea id="a-correction" placeholder="Débit … / Crédit … pour …">${echapper(a.correction)}</textarea>
        <div class="pied" style="margin-bottom:0"><button type="button" data-annuler>Annuler</button><button class="principal" value="ok">Enregistrer</button></div>
      </form>`;
    dialogue.querySelector('[data-annuler]').onclick = () => dialogue.close();
    dialogue.querySelector('form').onsubmit = () => {
      const v = (id) => dialogue.querySelector('#' + id).value.trim();
      Object.assign(a, { type: v('a-type'), nature: v('a-nature'), montant: v('a-montant'), procedure: v('a-procedure'), correction: v('a-correction') });
      a.opIds = [...new Set(a.lignes.flatMap((l) => l.opIds))];
      if (!existante) { anomalies.push(a); cochees.clear(); majBarre(); onglet = 'anomalies'; }
      sauver();
      dessiner();
    };
    dialogue.showModal();
  }

  conteneur.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.onglet) { onglet = b.dataset.onglet; dessiner(); }
    else if (b.dataset.action === 'vider') { cochees.clear(); majBarre(); dessiner(); }
    else if (b.dataset.action === 'declarer') ouvrirFormulaire(null);
    else if (b.dataset.modifier) ouvrirFormulaire(anomalies.find((a) => a.id === b.dataset.modifier));
    else if (b.dataset.supprimer && confirm('Supprimer cette anomalie ?')) {
      anomalies.splice(anomalies.findIndex((a) => a.id === b.dataset.supprimer), 1);
      sauver();
      dessiner();
    }
  });

  dessiner();
  majBarre();
}
