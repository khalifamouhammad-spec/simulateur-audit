// Tableau filtrable et triable, avec cases à cocher optionnelles.
import { echapper, dateFr, montantOuVide } from './utils.js';

/**
 * colonnes : [{ cle, titre, type: 'texte' | 'date' | 'montant' }]
 * lignes   : objets portant un « ligneId » unique
 * selection (optionnel) : { contient(ligne), basculer(ligne, coche), etiquette(ligne), actif }
 */
export function creerTableau({ colonnes, lignes, selection = null, entete = '', pied = '' }) {
  const racine = document.createElement('div');
  let filtre = '';
  let tri = null; // { cle, sens }

  racine.innerHTML = `
    <input type="search" placeholder="Filtrer (libellé, date, montant…)" aria-label="Filtrer le tableau" style="margin-bottom:.5rem">
    <div class="defilement"><table>
      <thead><tr>${selection ? '<th></th>' : ''}${colonnes.map((c) => `<th data-tri="${c.cle}" class="${c.type === 'montant' ? 'nombre' : ''}">${echapper(c.titre)}</th>`).join('')}</tr></thead>
      <tbody></tbody>
    </table></div>
    <p class="discret" data-compteur></p>`;
  const corps = racine.querySelector('tbody');

  const cellule = (l, c) => {
    const v = l[c.cle];
    if (c.type === 'date') return `<td class="date">${dateFr(v)}</td>`;
    if (c.type === 'montant') return `<td class="nombre">${montantOuVide(v)}</td>`;
    return `<td>${echapper(v)}</td>`;
  };
  const texteLigne = (l) => colonnes.map((c) => (c.type === 'date' ? dateFr(l[c.cle]) : c.type === 'montant' ? montantOuVide(l[c.cle]) : l[c.cle])).join(' ').toLowerCase();

  function dessiner() {
    const mots = filtre.toLowerCase().split(/\s+/).filter(Boolean);
    let visibles = lignes.filter((l) => { const t = texteLigne(l); return mots.every((m) => t.includes(m)); });
    if (tri) {
      const col = colonnes.find((c) => c.cle === tri.cle);
      visibles = [...visibles].sort((a, b) => {
        const x = a[tri.cle]; const y = b[tri.cle];
        return (col.type === 'montant' ? (x || 0) - (y || 0) : String(x ?? '').localeCompare(String(y ?? ''), 'fr')) * tri.sens;
      });
    }
    const nbCol = colonnes.length + (selection ? 1 : 0);
    corps.innerHTML = (filtre || tri ? '' : entete) + visibles.map((l) => {
      const coche = selection?.contient(l);
      const etiq = selection?.etiquette(l) || '';
      return `<tr data-id="${echapper(l.ligneId)}" class="${coche ? 'cochee' : etiq ? 'declaree' : ''}">
        ${selection ? `<td class="case"><input type="checkbox" ${coche ? 'checked' : ''} ${selection.actif ? '' : 'disabled'} aria-label="Cocher la ligne">${etiq ? `<br><span class="etiquette">${echapper(etiq)}</span>` : ''}</td>` : ''}
        ${colonnes.map((c) => cellule(l, c)).join('')}</tr>`;
    }).join('') + (filtre || tri ? '' : pied) || `<tr><td colspan="${nbCol}" class="discret">Aucune ligne.</td></tr>`;
    racine.querySelector('[data-compteur]').textContent = `${visibles.length} ligne(s) sur ${lignes.length}${tri ? ' — tri actif : cliquez à nouveau sur l\'en-tête pour inverser' : ''}`;
  }

  racine.querySelector('input[type=search]').addEventListener('input', (e) => { filtre = e.target.value; dessiner(); });
  racine.querySelector('thead').addEventListener('click', (e) => {
    const cle = e.target.closest('th')?.dataset.tri;
    if (!cle) return;
    tri = tri?.cle === cle ? (tri.sens === 1 ? { cle, sens: -1 } : null) : { cle, sens: 1 };
    dessiner();
  });
  corps.addEventListener('change', (e) => {
    if (e.target.type !== 'checkbox') return;
    const ligne = lignes.find((l) => l.ligneId === e.target.closest('tr').dataset.id);
    selection.basculer(ligne, e.target.checked);
    dessiner();
  });
  dessiner();
  racine.redessiner = dessiner;
  return racine;
}
