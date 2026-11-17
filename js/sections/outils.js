// Outils d'audit propres aux cycles : balance âgée, lettrage, documents postérieurs à la clôture,
// inventaire, tableau des immobilisations, récapitulatif de paie, cohérence de TVA, capitaux propres.
// Tout est calculé à partir du FEC et des données du dossier. Les documents postérieurs mêlent des
// éléments liés aux anomalies cachées et des documents ordinaires, sans les distinguer.
//
// Chaque outil reçoit ctx = { dossier, annee, lignes (FEC N), donnees (données cachées), etat, rendre }
// et renvoie { html, items } ; items associe la clé d'une case à cocher à la ligne sélectionnable.
import { aleatoire, ajouterJours, echapper, dateFr, euro, montantOuVide, ecartJours } from '../utils.js';
import { COL, PLAN } from '../moteur/plan.js';

const c = (n) => Math.round(n * 100);
const nombre = (n) => montantOuVide(n) || '0,00';
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1).replace('.', ',')} %`);

export const OUTILS = {
  balanceClients: { titre: 'Balance âgée clients', rendre: (ctx) => balanceAgee(ctx, '411', 'lettrageClients') },
  lettrageClients: { titre: 'Lettrage des comptes clients', rendre: (ctx) => lettrage(ctx, '411') },
  avoirs: { titre: 'Avoirs émis après la clôture', rendre: avoirsPosterieurs },
  annonces: { titre: 'Annonces légales (BODACC) concernant les clients', rendre: annoncesLegales },
  balanceFournisseurs: { titre: 'Balance âgée fournisseurs', rendre: (ctx) => balanceAgee(ctx, '40', 'lettrageFournisseurs') },
  lettrageFournisseurs: { titre: 'Lettrage des comptes fournisseurs', rendre: (ctx) => lettrage(ctx, '40') },
  factures: { titre: 'Factures fournisseurs reçues après la clôture', rendre: facturesPosterieures },
  inventaire: { titre: "Procès-verbal d'inventaire et stock comptable", rendre: inventaire },
  tableauImmobilisations: { titre: 'Tableau de variation des immobilisations', rendre: tableauImmobilisations },
  recapitulatifPaie: { titre: 'Récapitulatif mensuel de la paie', rendre: recapitulatifPaie },
  coherenceTva: { titre: "Cohérence chiffre d'affaires / TVA collectée", rendre: coherenceTva },
  capitauxPropres: { titre: 'Variation des capitaux propres et dettes financières', rendre: capitauxPropres },
};

const caseCochee = (ctx, cle) => `<td><input type="checkbox" data-cle="${cle}" ${ctx.panier.has(cle) ? 'checked' : ''} aria-label="Sélectionner la ligne"></td>`;
const itemFec = (l) => ({ cle: `fec|N|${l[COL.EcritureNum]}`, source: 'fec', exercice: 'N', num: l[COL.EcritureNum], date: l[COL.EcritureDate], piece: l[COL.PieceRef], lib: `${l[COL.EcritureLib]}${l[COL.CompAuxLib] ? ` (${l[COL.CompAuxLib]})` : ''}`, compte: l[COL.CompteNum], montant: l[COL.Debit] - l[COL.Credit] });
const itemDoc = (id, date, lib, montant) => ({ cle: `doc|${id}`, source: 'doc', exercice: 'N', id, num: '', date, piece: id, lib, montant });

// ------------------------------------------------------------------ Tiers : lignes ouvertes
function lignesTiers(lignes, prefixe) {
  return lignes.filter((l) => l[COL.CompAuxNum] && l[COL.CompteNum].startsWith(prefixe));
}

function balanceAgee(ctx, prefixe, outilLettrage) {
  const fin = `${ctx.annee}-12-31`;
  const tranches = [['≤ 30 j', 30], ['31-60 j', 60], ['61-90 j', 90], ['91-180 j', 180], ['> 180 j', Infinity]];
  const parTiers = new Map();
  for (const l of lignesTiers(ctx.lignes, prefixe)) {
    const t = parTiers.get(l[COL.CompAuxNum]) || { num: l[COL.CompAuxNum], nom: l[COL.CompAuxLib], solde: 0, tranches: tranches.map(() => 0), ouvertes: 0, comptes: new Set() };
    const m = c(l[COL.Debit]) - c(l[COL.Credit]);
    t.solde += m;
    t.comptes.add(l[COL.CompteNum]);
    if (!l[COL.EcritureLet]) {
      const age = ecartJours(l[COL.PieceDate] || l[COL.EcritureDate], fin);
      t.tranches[tranches.findIndex(([, max]) => age <= max)] += m;
      t.ouvertes++;
    }
    parTiers.set(t.num, t);
  }
  const fournisseur = prefixe === '40';
  const tiers = [...parTiers.values()].filter((t) => t.solde !== 0 || t.ouvertes).sort((a, b) => Math.abs(b.solde) - Math.abs(a.solde));
  const total = (f) => tiers.reduce((s, t) => s + f(t), 0) / 100;
  const anormal = (t) => (fournisseur ? t.solde > 0 : t.solde < 0);
  return {
    html: `
      <p class="discret">Postes non lettrés au 31/12/${ctx.annee}, classés par ancienneté de la pièce. Solde ${fournisseur ? 'créditeur = dette (affiché en négatif)' : 'débiteur = créance'}. Les soldes de sens anormal sont signalés. Cliquez sur un tiers pour ouvrir son compte en lettrage.</p>
      <div class="defilement haut"><table class="dense">
        <thead><tr><th>Tiers</th><th>Comptes</th><th class="nombre">Solde</th>${tranches.map(([lib]) => `<th class="nombre">${lib}</th>`).join('')}<th class="nombre">Postes ouverts</th></tr></thead>
        <tbody>${tiers.map((t) => `<tr class="${anormal(t) ? 'significatif' : ''}"><td><a href="#" data-tiers="${t.num}" data-outil="${outilLettrage}">${echapper(t.nom)}</a> <span class="code discret">${t.num}</span>${anormal(t) ? ' <span class="pastille orange">Solde de sens anormal</span>' : ''}</td>
          <td class="code">${[...t.comptes].join(', ')}</td><td class="nombre">${nombre(t.solde / 100)}</td>${t.tranches.map((x) => `<td class="nombre">${montantOuVide(x / 100)}</td>`).join('')}<td class="nombre">${t.ouvertes}</td></tr>`).join('') || '<tr><td colspan="9" class="vide">Aucun poste ouvert.</td></tr>'}
        <tr class="total"><td colspan="2">Total (${tiers.length} tiers)</td><td class="nombre">${nombre(total((t) => t.solde))}</td>${tranches.map((_, i) => `<td class="nombre">${nombre(total((t) => t.tranches[i]))}</td>`).join('')}<td></td></tr></tbody>
      </table></div>`,
    items: new Map(),
  };
}

function lettrage(ctx, prefixe) {
  const toutes = lignesTiers(ctx.lignes, prefixe);
  const tiers = [...new Map(toutes.map((l) => [l[COL.CompAuxNum], l[COL.CompAuxLib]])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  const choisi = ctx.etat.tiers && tiers.some(([n]) => n === ctx.etat.tiers) ? ctx.etat.tiers : tiers[0]?.[0];
  const seulementOuvertes = !!ctx.etat.ouvertes;
  const lignes = toutes.filter((l) => l[COL.CompAuxNum] === choisi && (!seulementOuvertes || !l[COL.EcritureLet]));
  const items = new Map(lignes.map((l) => { const it = itemFec(l); return [it.cle, it]; }));
  const solde = toutes.filter((l) => l[COL.CompAuxNum] === choisi).reduce((s, l) => s + c(l[COL.Debit]) - c(l[COL.Credit]), 0);
  const cochees = lignes.filter((l) => ctx.panier.has(itemFec(l).cle));
  const sommeCochees = cochees.reduce((s, l) => s + c(l[COL.Debit]) - c(l[COL.Credit]), 0);
  return {
    html: `
      <div class="filtres">
        <label>Tiers <select data-etat-outil="tiers">${tiers.map(([n, nom]) => `<option value="${n}" ${n === choisi ? 'selected' : ''}>${echapper(nom)} (${n})</option>`).join('')}</select></label>
        <label class="en-ligne" style="align-self:flex-end"><input type="checkbox" data-etat-outil="ouvertes" ${seulementOuvertes ? 'checked' : ''}> Lignes non lettrées seulement</label>
      </div>
      <p class="discret">Solde du compte : <strong>${euro(solde / 100)}</strong>. Cochez des lignes pour tester un lettrage : ${cochees.length ? `les ${cochees.length} ligne(s) cochée(s) totalisent <strong>${euro(sommeCochees / 100)}</strong> — ${sommeCochees === 0 ? '<span class="pastille vert">elles se lettrent</span>' : '<span class="pastille orange">écart, elles ne se lettrent pas</span>'}` : 'aucune ligne cochée'}. Les lignes cochées rejoignent la sélection (feuille de travail, pièces, ajustement).</p>
      <div class="defilement haut"><table class="dense fec">
        <thead><tr><th></th><th>Date</th><th>Jal</th><th>N° écriture</th><th>Pièce</th><th>Libellé</th><th>Compte</th><th class="nombre">Débit</th><th class="nombre">Crédit</th><th>Lettre</th><th>Date let.</th></tr></thead>
        <tbody>${lignes.map((l) => { const it = itemFec(l); return `<tr class="${ctx.panier.has(it.cle) ? 'cochee' : l[COL.EcritureLet] ? '' : 'non-lettree'}">${caseCochee(ctx, it.cle)}<td class="date">${dateFr(l[COL.EcritureDate])}</td><td>${l[COL.JournalCode]}</td><td class="code">${l[COL.EcritureNum]}</td><td>${echapper(l[COL.PieceRef])}</td><td>${echapper(l[COL.EcritureLib])}</td><td class="code">${l[COL.CompteNum]}</td>
          <td class="nombre">${montantOuVide(l[COL.Debit])}</td><td class="nombre">${montantOuVide(l[COL.Credit])}</td><td class="code">${echapper(l[COL.EcritureLet])}</td><td class="date">${dateFr(l[COL.DateLet])}</td></tr>`; }).join('') || '<tr><td colspan="11" class="vide">Aucune ligne.</td></tr>'}</tbody>
      </table></div>`,
    items,
    redessinerApresSelection: true,
  };
}

// ------------------------------------------------------------------ Documents postérieurs à la clôture
const tirage = (ctx, sel) => aleatoire((ctx.dossier.scenario.graine ^ sel) >>> 0);

function avoirsPosterieurs(ctx) {
  const rnd = tirage(ctx, 0x2a4b);
  const reels = (ctx.donnees?.posterieur?.avoirs || []).map((a, i) => ({ id: `AV-${i}`, date: a.date, client: a.client, origine: a.piece, motif: a.motif, ht: a.ht / 100 }));
  const motifs = ['Remise commerciale de fin de saison accordée sur les livraisons de janvier', 'Erreur de quantité sur une facture de janvier', 'Escompte pour paiement anticipé', 'Retour partiel de marchandises livrées en janvier'];
  const leurres = Array.from({ length: rnd.entier(2, 4) }, (_, i) => ({ id: `AVX-${i}`, date: `${ctx.annee + 1}-0${rnd.entier(1, 2)}-${String(rnd.entier(10, 27)).padStart(2, '0')}`, client: rnd.choix(ctx.dossier.tiers.clients).nom,
    origine: `FA${ctx.annee + 1}-${String(rnd.entier(3, 90)).padStart(5, '0')}`, motif: rnd.choix(motifs), ht: Math.round(ctx.dossier.chiffres.N.chiffreAffaires * (0.0002 + rnd() * 0.0008) * 100) / 100 }));
  return documentsListe(ctx, [...reels, ...leurres].sort((a, b) => a.date.localeCompare(b.date)),
    `Avoirs émis par la société du 1er janvier au 28 février ${ctx.annee + 1}, extraits du logiciel de facturation.`,
    ['Date', 'Client', 'Facture d\'origine', 'Motif', 'Montant HT'], (x) => [dateFr(x.date), echapper(x.client), `<span class="code">${echapper(x.origine)}</span>`, echapper(x.motif), `<span class="nombre">${nombre(x.ht)}</span>`],
    (x) => itemDoc(x.id, x.date, `Avoir ${x.client} sur ${x.origine} — ${x.motif}`, -x.ht));
}

function facturesPosterieures(ctx) {
  const rnd = tirage(ctx, 0x6c1d);
  const reels = (ctx.donnees?.posterieur?.factures || []).map((f, i) => ({ id: `FAC-${i}`, date: f.date, fournisseur: f.fournisseur, objet: f.lib, ht: f.ht / 100, tva: f.tva / 100 }));
  const fournisseurs = ctx.dossier.tiers.fournisseurs;
  const leurres = Array.from({ length: rnd.entier(4, 7) }, (_, i) => {
    const f = rnd.choix(fournisseurs);
    const ht = Math.round(ctx.dossier.chiffres.N.chiffreAffaires * (0.0005 + rnd() * 0.002) * 100) / 100;
    return { id: `FACX-${i}`, date: `${ctx.annee + 1}-0${rnd.entier(1, 2)}-${String(rnd.entier(5, 27)).padStart(2, '0')}`, fournisseur: f.nom, objet: `${PLAN[f.compteCharge] || 'Achat'} — ${rnd.choix(['livraison', 'prestation', 'période'])} de janvier ${ctx.annee + 1}`, ht, tva: Math.round(ht * 20) / 100 };
  });
  return documentsListe(ctx, [...reels, ...leurres].sort((a, b) => a.date.localeCompare(b.date)),
    `Factures fournisseurs reçues et enregistrées du 1er janvier au 28 février ${ctx.annee + 1}. Comparez la période de la prestation à la date de clôture et aux factures non parvenues comptabilisées (compte 408100).`,
    ['Reçue le', 'Fournisseur', 'Objet', 'HT', 'TVA'], (x) => [dateFr(x.date), echapper(x.fournisseur), echapper(x.objet), `<span class="nombre">${nombre(x.ht)}</span>`, `<span class="nombre">${nombre(x.tva)}</span>`],
    (x) => itemDoc(x.id, x.date, `Facture ${x.fournisseur} — ${x.objet}`, -(x.ht + x.tva)));
}

function annoncesLegales(ctx) {
  const rnd = tirage(ctx, 0x3e77);
  const reels = (ctx.donnees?.posterieur?.faits || []).filter((f) => f.type === 'procedure_collective').map((f, i) => ({ id: `BODACC-${i}`, date: f.date, societe: f.client, nature: 'Jugement d\'ouverture d\'une liquidation judiciaire' }));
  const natures = ['Transfert du siège social', 'Nomination d\'un nouveau président', 'Augmentation de capital', 'Modification de l\'objet social', 'Dépôt des comptes annuels'];
  const leurres = Array.from({ length: rnd.entier(3, 5) }, (_, i) => ({ id: `BODACCX-${i}`, date: ajouterJours(`${ctx.annee}-07-01`, rnd.entier(0, 240)), societe: rnd.choix(ctx.dossier.tiers.clients).nom, nature: rnd.choix(natures) }));
  return documentsListe(ctx, [...reels, ...leurres].sort((a, b) => a.date.localeCompare(b.date)),
    'Résultat de la consultation des annonces légales pour les principaux clients (second semestre et début d\'exercice suivant).',
    ['Date', 'Société', 'Nature de l\'annonce'], (x) => [dateFr(x.date), echapper(x.societe), echapper(x.nature)],
    (x) => itemDoc(x.id, x.date, `BODACC — ${x.societe} : ${x.nature}`, 0));
}

function documentsListe(ctx, liste, intro, entetes, cellules, versItem) {
  const items = new Map(liste.map((x) => { const it = versItem(x); return [it.cle, it]; }));
  return {
    html: `<p class="discret">${intro}</p>
      <div class="defilement"><table class="dense"><thead><tr><th></th>${entetes.map((e) => `<th>${e}</th>`).join('')}</tr></thead>
      <tbody>${liste.map((x) => { const it = versItem(x); return `<tr class="${ctx.panier.has(it.cle) ? 'cochee' : ''}">${caseCochee(ctx, it.cle)}${cellules(x).map((v) => `<td>${v}</td>`).join('')}</tr>`; }).join('') || `<tr><td colspan="${entetes.length + 1}" class="vide">Aucun document.</td></tr>`}</tbody></table></div>`,
    items,
  };
}

// ------------------------------------------------------------------ Tableaux de synthèse calculés à partir du FEC
/** Mouvements d'un compte : ouverture (AN), débits, crédits, clôture — en centimes. */
function mouvements(lignes, filtre) {
  const comptes = new Map();
  for (const l of lignes) {
    const num = l[COL.CompteNum];
    if (!filtre(num)) continue;
    const x = comptes.get(num) || { compte: num, libelle: l[COL.CompteLib], ouverture: 0, debit: 0, credit: 0 };
    if (l[COL.JournalCode] === 'AN') x.ouverture += c(l[COL.Debit]) - c(l[COL.Credit]);
    else { x.debit += c(l[COL.Debit]); x.credit += c(l[COL.Credit]); }
    comptes.set(num, x);
  }
  return [...comptes.values()].sort((a, b) => a.compte.localeCompare(b.compte)).map((x) => ({ ...x, cloture: x.ouverture + x.debit - x.credit }));
}

function tableauDoc(ctx, intro, entetes, lignes, total = '') {
  const items = new Map(lignes.map((l) => [l.item.cle, l.item]));
  return {
    html: `<p class="discret">${intro}</p><div class="defilement"><table class="dense"><thead><tr><th></th>${entetes.map((e, i) => `<th class="${i ? 'nombre' : ''}">${e}</th>`).join('')}</tr></thead>
      <tbody>${lignes.map((l) => `<tr class="${ctx.panier.has(l.item.cle) ? 'cochee' : l.classe || ''}">${caseCochee(ctx, l.item.cle)}${l.cellules.map((v, i) => `<td class="${i ? 'nombre' : ''}">${v}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${entetes.length + 1}" class="vide">Aucune donnée.</td></tr>`}${total}</tbody></table></div>`,
    items,
  };
}

function inventaire(ctx) {
  const inv = ctx.donnees?.inventaire;
  if (!inv) return { html: '<p class="message info">Cette entité ne détient pas de stocks : le cycle est sans objet. Marquez les procédures « non applicable » en le justifiant.</p>', items: new Map() };
  const comptes = mouvements(ctx.lignes, (n) => /^3/.test(n));
  const comptable = comptes.reduce((s, x) => s + x.cloture, 0);
  const achats = mouvements(ctx.lignes, (n) => /^60[17]/.test(n)).reduce((s, x) => s + x.debit - x.credit, 0);
  const lignes = [
    { item: itemDoc('INV', `${ctx.annee}-12-31`, `Stock comptabilisé au 31/12 (${euro(comptable / 100)})`, comptable / 100), cellules: ['Stock comptabilisé au 31/12 (balance)', nombre(comptable / 100)] },
    { item: itemDoc('INV-PV', `${ctx.annee}-12-31`, `Procès-verbal d'inventaire physique (${euro(inv.stockReel / 100)})`, inv.stockReel / 100), cellules: ["Valeur du procès-verbal d'inventaire physique signé", nombre(inv.stockReel / 100)] },
  ];
  return tableauDoc(ctx, `Procès-verbal établi par le client à l'issue du comptage du ${dateFr(`${ctx.annee}-12-31`)}, valorisé au coût d'achat. Stock d'ouverture : ${euro(comptes.reduce((s, x) => s + x.ouverture, 0) / 100)} ; achats consommables de l'exercice : ${euro(achats / 100)} ; rotation apparente : ${achats ? Math.round((comptable / achats) * 360) : '—'} jours.`,
    ['Élément', 'Montant'], lignes);
}

function tableauImmobilisations(ctx) {
  const brutes = mouvements(ctx.lignes, (n) => /^2[0-7]/.test(n));
  const amort = mouvements(ctx.lignes, (n) => /^28/.test(n));
  const attente = mouvements(ctx.lignes, (n) => n === '471000');
  const ligne = (x, type) => ({
    item: itemDoc(`IMMO-${x.compte}`, `${ctx.annee}-12-31`, `Tableau des immobilisations — ${x.compte} ${x.libelle}`, x.cloture / 100),
    cellules: [`<span class="code">${x.compte}</span> ${echapper(x.libelle)}`, nombre(x.ouverture / 100),
      nombre((type === 'amort' ? x.credit : x.debit) / 100), nombre((type === 'amort' ? x.debit : x.credit) / 100), nombre(x.cloture / 100),
      type === 'amort' ? pct(x.ouverture ? x.credit / -x.ouverture : null) : ''],
  });
  const total = (liste) => liste.reduce((s, x) => s + x.cloture, 0) / 100;
  return tableauDoc(ctx, "Variation de l'exercice calculée à partir du FEC. Pour les amortissements, « augmentations » = dotations, « diminutions » = reprises et sorties ; la dernière colonne rapporte la dotation au cumul d'ouverture.",
    ['Compte', 'Ouverture', 'Augmentations', 'Diminutions', 'Clôture', 'Dotation / cumul ouverture'],
    [...brutes.map((x) => ligne(x, 'brut')), ...amort.map((x) => ({ ...ligne(x, 'amort'), classe: x.credit === 0 && x.ouverture !== 0 ? 'significatif' : '' })), ...attente.map((x) => ({ ...ligne(x, 'brut'), classe: x.cloture ? 'significatif' : '' }))],
    `<tr class="total"><td></td><td>Valeur brute / amortissements / valeur nette</td><td></td><td></td><td></td><td class="nombre">${nombre(total(brutes))} / ${nombre(total(amort))} / ${nombre(total(brutes) + total(amort))}</td><td></td></tr>`);
}

function recapitulatifPaie(ctx) {
  const mois = Array.from({ length: 12 }, () => ({ brut: 0, patronales: 0, net: 0 }));
  for (const l of ctx.lignes) {
    if (l[COL.JournalCode] !== 'PA') continue;
    const m = mois[Number(l[COL.EcritureDate].slice(5, 7)) - 1];
    if (l[COL.CompteNum].startsWith('6411')) m.brut += c(l[COL.Debit]);
    else if (l[COL.CompteNum].startsWith('6451')) m.patronales += c(l[COL.Debit]);
    else if (l[COL.CompteNum].startsWith('421')) m.net += c(l[COL.Credit]);
  }
  const lignes = mois.map((m, i) => ({
    item: itemDoc(`PAIE-${i + 1}`, `${ctx.annee}-${String(i + 1).padStart(2, '0')}-28`, `Paie de ${MOIS[i].toLowerCase()} : brut ${euro(m.brut / 100)}, charges patronales ${euro(m.patronales / 100)}`, m.patronales / 100),
    cellules: [MOIS[i], nombre(m.brut / 100), nombre(m.net / 100), nombre(m.patronales / 100), pct(m.brut ? m.patronales / m.brut : null)],
  }));
  const t = (k) => mois.reduce((s, m) => s + m[k], 0);
  return tableauDoc(ctx, `Écritures du journal de paie (PA), mois par mois. Effectif déclaré : ${ctx.dossier.client.effectif} salariés.`,
    ['Mois', 'Salaires bruts', 'Net à payer', 'Charges patronales', 'Charges / brut'], lignes,
    `<tr class="total"><td></td><td>Total</td><td class="nombre">${nombre(t('brut') / 100)}</td><td class="nombre">${nombre(t('net') / 100)}</td><td class="nombre">${nombre(t('patronales') / 100)}</td><td class="nombre">${pct(t('brut') ? t('patronales') / t('brut') : null)}</td></tr>`);
}

function coherenceTva(ctx) {
  const mois = Array.from({ length: 12 }, () => ({ ca: 0, tva: 0 }));
  for (const l of ctx.lignes) {
    if (l[COL.JournalCode] !== 'VE') continue;
    const m = mois[Number(l[COL.EcritureDate].slice(5, 7)) - 1];
    if (l[COL.CompteNum].startsWith('70')) m.ca += c(l[COL.Credit]) - c(l[COL.Debit]);
    else if (l[COL.CompteNum].startsWith('44571')) m.tva += c(l[COL.Credit]) - c(l[COL.Debit]);
  }
  const lignes = mois.map((m, i) => ({
    item: itemDoc(`TVA-${i + 1}`, `${ctx.annee}-${String(i + 1).padStart(2, '0')}-28`, `TVA de ${MOIS[i].toLowerCase()} : CA ${euro(m.ca / 100)}, TVA collectée ${euro(m.tva / 100)}`, m.tva / 100),
    cellules: [MOIS[i], nombre(m.ca / 100), nombre(m.tva / 100), pct(m.ca ? m.tva / m.ca : null)],
  }));
  const ca = mois.reduce((s, m) => s + m.ca, 0); const tva = mois.reduce((s, m) => s + m.tva, 0);
  return tableauDoc(ctx, "Chiffre d'affaires et TVA collectée comptabilisés au journal des ventes, mois par mois. Comparez le taux apparent au taux applicable à l'activité.",
    ['Mois', "Chiffre d'affaires HT", 'TVA collectée', 'Taux apparent'], lignes,
    `<tr class="total"><td></td><td>Exercice</td><td class="nombre">${nombre(ca / 100)}</td><td class="nombre">${nombre(tva / 100)}</td><td class="nombre">${pct(ca ? tva / ca : null)}</td></tr>`);
}

function capitauxPropres(ctx) {
  const comptes = mouvements(ctx.lignes, (n) => /^1/.test(n) || n === '455000');
  let resultat = 0;
  for (const l of ctx.lignes) if (/^[67]/.test(l[COL.CompteNum])) resultat += c(l[COL.Credit]) - c(l[COL.Debit]);
  const lignes = comptes.map((x) => ({
    item: itemDoc(`CAP-${x.compte}`, `${ctx.annee}-12-31`, `${x.compte} ${x.libelle} : ouverture ${euro(-x.ouverture / 100)}, clôture ${euro(-x.cloture / 100)}`, -x.cloture / 100),
    cellules: [`<span class="code">${x.compte}</span> ${echapper(x.libelle)}`, nombre(-x.ouverture / 100), nombre(x.credit / 100), nombre(x.debit / 100), nombre(-x.cloture / 100)],
  }));
  return tableauDoc(ctx, `Comptes de capitaux, de dettes financières et de comptes courants (soldes créditeurs en positif). Résultat de l'exercice ${ctx.annee} avant affectation : ${euro(resultat / 100)}.`,
    ['Compte', 'Ouverture', 'Augmentations', 'Diminutions', 'Clôture'], lignes);
}
