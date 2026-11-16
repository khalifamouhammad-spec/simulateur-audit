// Générateur de cas hors-ligne (sans IA) pour le cycle trésorerie.
// Produit un JSON brut au même format que l'IA : il passe donc par les mêmes contrôles.
import { aleatoire, ajouterJours, dateFr } from '../utils.js';

const ENTREPRISES = [
  { nom: 'Menuiserie Valbois', secteur: 'Fabrication de menuiseries bois sur mesure', forme: 'SAS', effectif: 24, ca: 3200000,
    contexte: "PME familiale reprise il y a deux ans par le fils du fondateur. La comptable historique est partie en septembre et son remplaçant, recruté en intérim, tient seul la trésorerie et les rapprochements. Le dirigeant signe les règlements sans revue formalisée." },
  { nom: 'Transports Kerlouan', secteur: 'Transport routier de marchandises', forme: 'SARL', effectif: 38, ca: 5400000,
    contexte: "Société de transport régional dont l'activité progresse de 12 % sur l'exercice. La trésorerie est tendue en fin d'année et la banque a demandé les comptes pour le renouvellement de la ligne de découvert. Le rapprochement bancaire est établi par l'assistante de gestion." },
  { nom: 'Atelier Numérique Sorel', secteur: 'Agence web et développement logiciel', forme: 'SAS', effectif: 15, ca: 1800000,
    contexte: "Agence en forte croissance, financée par une levée de fonds l'an dernier. La comptabilité est internalisée depuis janvier avec un nouveau logiciel. Le directeur administratif dispose seul des accès bancaires et valide lui-même les virements." },
  { nom: 'Distribution Maraîchère du Lauragais', secteur: 'Négoce de fruits et légumes', forme: 'SAS', effectif: 31, ca: 7600000,
    contexte: "Grossiste travaillant avec de nombreux petits clients réglant par chèque. Les remises en banque sont fréquentes et les volumes importants en fin d'année. Le commissaire aux comptes a relevé l'an dernier des suspens non apurés." },
  { nom: 'Clinique Vétérinaire des Tilleuls', secteur: 'Soins vétérinaires', forme: 'SELARL', effectif: 12, ca: 1450000,
    contexte: "Structure de quatre associés. La saisie comptable est sous-traitée mais les rapprochements bancaires sont faits en interne par la secrétaire, sans supervision. Un associé a quitté la structure en cours d'exercice." },
  { nom: 'Bâtiment Rénovation Morvan', secteur: 'Travaux de rénovation tous corps d\'état', forme: 'SARL', effectif: 19, ca: 2700000,
    contexte: "Entreprise du bâtiment dont le résultat est en baisse. Le gérant est rémunéré en partie sur le résultat et souhaite présenter une trésorerie positive à la clôture. Plusieurs sous-traitants sont réglés par virement sur simple demande du gérant." },
];

const CLIENTS = ['Durand SA', 'Ets Lemoine', 'SCI Les Acacias', 'Mairie de Vernay', 'Groupe Hexa', 'Sté Bertin', 'Cabinet Roux', 'Garage Pelletier', 'Hôtel du Parc', 'Librairie Colin', 'SARL Fabre', 'Martin & Fils'];
const FOURNISSEURS = ['Point P', 'Sonepar', 'Orange Pro', 'EDF Entreprises', 'Würth', 'Manutan', 'Total Énergies', 'Lyreco', 'Axa Assurances', 'Rexel', 'Brico Dépôt Pro', 'La Poste'];
const BENEFICIAIRES = ['Orion Consulting Ltd', 'MK Advisory', 'Stratège Conseil SASU', 'Global Trade Partners'];

const arrondi = (n) => Math.round(n * 100) / 100;

export function genererCasHorsLigne({ niveau = 'debutant', graine = Date.now() } = {}) {
  const rnd = aleatoire(graine);
  const e = rnd.choix(ENTREPRISES);
  const annee = new Date().getFullYear() - 1;
  const nbMois = niveau === 'debutant' ? 1 : niveau === 'intermediaire' ? 2 : 3;
  const fin = `${annee}-12-31`;
  const debut = `${annee}-${String(13 - nbMois).padStart(2, '0')}-01`;
  const ca = e.ca;
  // Les anomalies sont plus grosses (donc plus visibles) au niveau débutant.
  const echelle = { debutant: 0.012, intermediaire: 0.006, confirme: 0.003 }[niveau] * ca;

  // --- Balance de départ : les réserves sont calculées pour équilibrer ---
  const part = (t) => Math.round(ca * t);
  // La balance reprend toutes les écritures de l'exercice hors mouvements de banque de la période.
  const caCumule = ca;
  const lignes = [
    ['101', 'Capital', 0, part(0.03)],
    ['164', 'Emprunts auprès des établissements de crédit', 0, part(0.08)],
    ['2154', 'Matériel industriel', part(0.25), 0],
    ['2815', 'Amortissements du matériel', 0, part(0.1)],
    ['370', 'Stocks de marchandises', part(0.08), 0],
    ['401', 'Fournisseurs', 0, part(0.09)],
    ['411', 'Clients', part(0.17), 0],
    ['421', 'Personnel - rémunérations dues', 0, part(0.015)],
    ['431', 'Sécurité sociale', 0, part(0.015)],
    ['44551', 'TVA à décaisser', 0, part(0.02)],
    ['512', 'Banque', part(0.06), 0],
    ['607', 'Achats de marchandises', Math.round(caCumule * 0.52), 0],
    ['613', 'Locations', Math.round(caCumule * 0.05), 0],
    ['6226', 'Honoraires', Math.round(caCumule * 0.02), 0],
    ['627', 'Services bancaires', Math.round(caCumule * 0.004), 0],
    ['641', 'Rémunérations du personnel', Math.round(caCumule * 0.22), 0],
    ['645', 'Charges sociales', Math.round(caCumule * 0.09), 0],
    ['6811', 'Dotations aux amortissements', Math.round(caCumule * 0.03), 0],
    ['707', 'Ventes de marchandises', 0, caCumule],
  ];
  const ecart = lignes.reduce((s, l) => s + l[2] - l[3], 0);
  lignes.splice(1, 0, ['106', 'Réserves', ecart < 0 ? -ecart : 0, ecart > 0 ? ecart : 0]);
  const balance_ouverture = lignes.map(([compte, libelle, debit, credit]) => ({ compte, libelle, debit, credit }));

  // --- Opérations courantes ---
  const operations = [];
  let n = 0;
  let cheque = rnd.entier(4200, 4800) * 1000 + 101;
  const ajouter = (o) => {
    const op = { id: 'OP' + String(++n).padStart(3, '0'), montant_banque: null, piece: '', ...o };
    operations.push(op);
    return op;
  };
  const jour = (mois, j) => `${annee}-${String(mois).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
  const montantCourant = (min, max) => arrondi(ca * (min + rnd() * (max - min)));

  for (let mois = 13 - nbMois; mois <= 12; mois++) {
    // Encaissements clients
    const [nbClients, nbFournisseurs] = [[15, 11], [8, 7], [6, 5]][nbMois - 1];
    for (let i = 0, max = nbClients + rnd.entier(0, 2); i < max; i++) {
      const j = rnd.entier(1, 28);
      const client = rnd.choix(CLIENTS);
      if (rnd() < 0.6) {
        ajouter({ libelle: `Virement reçu ${client}`, libelle_banque: `VIR SEPA RECU ${client}`, piece: `FA-${rnd.entier(1000, 9999)}`, sens: 'encaissement',
          montant: montantCourant(0.004, 0.02), date_compta: jour(mois, j), date_banque: jour(mois, j), contrepartie: '411', contrepartie_libelle: 'Clients' });
      } else {
        const j2 = Math.min(j, 24);
        ajouter({ libelle: `Remise de chèques n° ${rnd.entier(100, 999)} (${client})`, libelle_banque: 'REMISE DE CHEQUES', piece: `BR-${rnd.entier(100, 999)}`, sens: 'encaissement',
          montant: montantCourant(0.003, 0.012), date_compta: jour(mois, j2), date_banque: ajouterJours(jour(mois, j2), rnd.entier(1, 2)), contrepartie: '411', contrepartie_libelle: 'Clients' });
      }
    }
    // Règlements fournisseurs
    for (let i = 0, max = nbFournisseurs + rnd.entier(0, 2); i < max; i++) {
      const j = rnd.entier(2, 27);
      const f = rnd.choix(FOURNISSEURS);
      if (rnd() < 0.5) {
        const num = cheque++;
        ajouter({ libelle: `Chèque n° ${num} ${f}`, libelle_banque: `CHEQUE ${num}`, piece: `CHQ ${num}`, sens: 'decaissement',
          montant: montantCourant(0.002, 0.012), date_compta: jour(mois, j), date_banque: ajouterJours(jour(mois, j), rnd.entier(3, 8)), contrepartie: '401', contrepartie_libelle: 'Fournisseurs' });
      } else {
        ajouter({ libelle: `Virement émis ${f}`, libelle_banque: `VIR SEPA ${f}`, piece: `VIR-${rnd.entier(1000, 9999)}`, sens: 'decaissement',
          montant: montantCourant(0.003, 0.015), date_compta: jour(mois, j), date_banque: ajouterJours(jour(mois, j), rnd.entier(0, 1)), contrepartie: '401', contrepartie_libelle: 'Fournisseurs' });
      }
    }
    // Opérations récurrentes
    const m2 = String(mois).padStart(2, '0');
    ajouter({ libelle: `Loyer ${m2}/${annee}`, libelle_banque: 'PRLV SEPA SCI FONCIERE DU CENTRE', piece: `QUIT-${m2}`, sens: 'decaissement', montant: arrondi(ca * 0.004), date_compta: jour(mois, 5), date_banque: jour(mois, 5), contrepartie: '613', contrepartie_libelle: 'Locations' });
    ajouter({ libelle: `URSSAF cotisations ${m2}/${annee}`, libelle_banque: 'PRLV SEPA URSSAF', piece: `DSN-${m2}`, sens: 'decaissement', montant: arrondi(ca * 0.009 * (0.95 + rnd() * 0.1)), date_compta: jour(mois, 15), date_banque: jour(mois, 15), contrepartie: '431', contrepartie_libelle: 'Sécurité sociale' });
    ajouter({ libelle: `Échéance emprunt ${m2}/${annee}`, libelle_banque: 'ECHEANCE PRET 00428731', piece: 'TA-PRET', sens: 'decaissement', montant: arrondi(ca * 0.0021), date_compta: jour(mois, 10), date_banque: jour(mois, 10), contrepartie: '164', contrepartie_libelle: 'Emprunts auprès des établissements de crédit' });
    ajouter({ libelle: `TVA à décaisser ${m2}/${annee}`, libelle_banque: 'PRLV SEPA DGFIP TVA', piece: `CA3-${m2}`, sens: 'decaissement', montant: arrondi(ca * 0.006 * (0.9 + rnd() * 0.2)), date_compta: jour(mois, 20), date_banque: jour(mois, 20), contrepartie: '44551', contrepartie_libelle: 'TVA à décaisser' });
    ajouter({ libelle: `Salaires nets ${m2}/${annee}`, libelle_banque: 'VIR SEPA SALAIRES', piece: `PAIE-${m2}`, sens: 'decaissement', montant: arrondi(ca * 0.014 * (0.97 + rnd() * 0.06)), date_compta: jour(mois, 28), date_banque: jour(mois, 28), contrepartie: '421', contrepartie_libelle: 'Personnel - rémunérations dues' });
    ajouter({ libelle: `Frais de tenue de compte ${m2}/${annee}`, libelle_banque: 'FRAIS TENUE DE COMPTE', piece: 'RELEVE', sens: 'decaissement', montant: arrondi(45 + rnd.entier(0, 30)), date_compta: jour(mois, 3), date_banque: jour(mois, 3), contrepartie: '627', contrepartie_libelle: 'Services bancaires' });
  }
  // Suspens normaux de fin d'année (débités ou crédités début janvier)
  for (let i = 0; i < 2; i++) {
    const num = cheque++;
    ajouter({ libelle: `Chèque n° ${num} ${rnd.choix(FOURNISSEURS)}`, libelle_banque: `CHEQUE ${num}`, piece: `CHQ ${num}`, sens: 'decaissement',
      montant: montantCourant(0.002, 0.008), date_compta: jour(12, rnd.entier(27, 30)), date_banque: `${annee + 1}-01-0${rnd.entier(3, 8)}`, contrepartie: '401', contrepartie_libelle: 'Fournisseurs' });
  }
  ajouter({ libelle: `Remise de chèques n° ${rnd.entier(100, 999)}`, libelle_banque: 'REMISE DE CHEQUES', piece: `BR-${rnd.entier(100, 999)}`, sens: 'encaissement',
    montant: montantCourant(0.003, 0.01), date_compta: jour(12, 31), date_banque: `${annee + 1}-01-02`, contrepartie: '411', contrepartie_libelle: 'Clients' });

  // --- Anomalies ---
  const anomalies = [];
  const omis = [];
  let libelle_ecart = null;
  const montantAnomalie = (f = 1) => arrondi(echelle * f * (0.7 + rnd() * 0.6));
  const declarer = (type, ops, explication, procedure, correction) =>
    anomalies.push({ id: 'A' + (anomalies.length + 1), type, operations: ops.map((o) => o.id), explication, procedure, correction });

  const fabriques = {
    cheque_ancien() {
      const num = cheque - rnd.entier(400, 600);
      const d = ajouterJours(fin, -rnd.entier(420, 600));
      const f = rnd.choix(FOURNISSEURS);
      const op = ajouter({ libelle: `Chèque n° ${num} ${f}`, libelle_banque: `CHEQUE ${num}`, piece: `CHQ ${num}`, sens: 'decaissement', montant: montantAnomalie(0.8), date_compta: d, date_banque: null, contrepartie: '401', contrepartie_libelle: 'Fournisseurs' });
      declarer('cheque_ancien', [op],
        `Le chèque n° ${num} émis le ${dateFr(d)} au profit de ${f} figure toujours en suspens au rapprochement, plus d'un an après son émission. Un chèque est prescrit un an après l'expiration du délai de présentation : il ne sera plus payé par la banque. La trésorerie est minorée à tort et la dette fournisseur doit être réexaminée.`,
        "Revue de l'ancienneté des suspens de l'état de rapprochement et contrôle de leur apurement sur les relevés postérieurs à la clôture (NEP 500, NEP 330).",
        `Débit 512 Banque / Crédit 401 Fournisseurs pour ${op.montant} € (la dette renaît), ou crédit d'un produit exceptionnel si la dette est éteinte.`);
    },
    suspens_ancien() {
      const d = ajouterJours(fin, -rnd.entier(120, 240));
      const op = ajouter({ libelle: `Remise de chèques n° ${rnd.entier(100, 999)}`, libelle_banque: 'REMISE DE CHEQUES', piece: `BR-${rnd.entier(100, 999)}`, sens: 'encaissement', montant: montantAnomalie(0.9), date_compta: d, date_banque: null, contrepartie: '411', contrepartie_libelle: 'Clients' });
      declarer('suspens_ancien', [op],
        `Une remise de chèques comptabilisée le ${dateFr(d)} n'a jamais été créditée par la banque. Une remise est normalement créditée sous quelques jours : chèque égaré, impayé non comptabilisé ou encaissement fictif. La trésorerie est surévaluée et la créance client n'est en réalité pas soldée.`,
        "Analyse de l'ancienneté des suspens du rapprochement, obtention du bordereau de remise tamponné par la banque et suivi de l'apurement sur les relevés postérieurs (NEP 500).",
        `Débit 411 Clients (ou 416 Clients douteux avec dépréciation) / Crédit 512 Banque pour ${op.montant} €.`);
    },
    virement_non_comptabilise() {
      const client = rnd.choix(CLIENTS);
      const d = jour(12, rnd.entier(8, 26));
      const op = ajouter({ libelle: `Virement reçu ${client}`, libelle_banque: `VIR SEPA RECU ${client}`, sens: 'encaissement', montant: montantAnomalie(), date_compta: null, date_banque: d, contrepartie: '411', contrepartie_libelle: 'Clients' });
      declarer('virement_non_comptabilise', [op],
        `Le virement reçu de ${client} le ${dateFr(d)} figure sur le relevé mais n'a pas été comptabilisé à la clôture. La trésorerie est sous-évaluée et la créance client surévaluée du même montant.`,
        "Pointage du relevé bancaire avec le grand livre 512 et examen des éléments en rapprochement « à comptabiliser » (NEP 500).",
        `Débit 512 Banque / Crédit 411 Clients pour ${op.montant} €.`);
    },
    frais_non_comptabilises() {
      const d = jour(12, rnd.entier(27, 31));
      const op = ajouter({ libelle: 'Commissions et agios du trimestre', libelle_banque: 'ARRETE DE COMPTE - INTERETS ET COMMISSIONS', sens: 'decaissement', montant: montantAnomalie(0.35), date_compta: null, date_banque: d, contrepartie: '627', contrepartie_libelle: 'Services bancaires' });
      declarer('frais_non_comptabilises', [op],
        `Les intérêts et commissions prélevés par la banque le ${dateFr(d)} ne sont pas comptabilisés à la clôture. Les charges de l'exercice et le solde de banque sont inexacts.`,
        "Pointage exhaustif des débits du relevé de décembre avec le grand livre et rapprochement avec l'échelle d'intérêts (NEP 500).",
        `Débit 627 Services bancaires (et 661 Charges d'intérêts pour les agios) / Crédit 512 Banque pour ${op.montant} €.`);
    },
    double_comptabilisation() {
      const candidats = operations.filter((o) => o.sens === 'encaissement' && o.date_compta >= debut && o.date_compta < jour(12, 27) && o.date_banque && o.date_banque <= fin);
      const virements = candidats.filter((o) => o.libelle.startsWith('Virement reçu'));
      const origine = rnd.choix(virements.length ? virements : candidats);
      const op = ajouter({ ...origine, id: undefined, date_compta: ajouterJours(origine.date_compta, rnd.entier(1, 3)), date_banque: null });
      op.id = 'OP' + String(n).padStart(3, '0');
      declarer('double_comptabilisation', [op],
        `L'encaissement « ${origine.libelle} » de ${origine.montant} € est comptabilisé deux fois (le ${dateFr(origine.date_compta)} et le ${dateFr(op.date_compta)}) alors que la banque ne l'a crédité qu'une fois. La trésorerie est surévaluée et la créance client soldée à tort.`,
        "Recherche de doublons (même montant, même tiers) dans le grand livre 512 et analyse des encaissements en suspens au rapprochement non crédités après la clôture (NEP 500).",
        `Débit 411 Clients / Crédit 512 Banque pour ${origine.montant} € (annulation du doublon).`);
    },
    cut_off() {
      const client = rnd.choix(CLIENTS);
      const jb = `${annee + 1}-01-${String(rnd.entier(8, 14)).padStart(2, '0')}`;
      const op = ajouter({ libelle: `Virement reçu ${client}`, libelle_banque: `VIR SEPA RECU ${client}`, piece: `Avis du ${dateFr(jb)}`, sens: 'encaissement', montant: montantAnomalie(1.3), date_compta: jour(12, 31), date_banque: jb, contrepartie: '411', contrepartie_libelle: 'Clients' });
      declarer('cut_off', [op],
        `Le virement de ${client} reçu le ${dateFr(jb)} a été comptabilisé au 31/12. Un virement n'a pas de délai d'encaissement de plusieurs jours : l'opération appartient à l'exercice suivant. La trésorerie de clôture est surévaluée et les créances clients sous-évaluées (habillage de bilan possible).`,
        "Test de césure : rapprochement des derniers mouvements comptabilisés en décembre avec les relevés de janvier N+1 et les avis d'opération (NEP 500, NEP 240 en cas d'intention).",
        `Débit 411 Clients / Crédit 512 Banque pour ${op.montant} € au 31/12 ; l'encaissement est à constater en N+1.`);
    },
    erreur_montant() {
      // Inversion de deux chiffres à la saisie (ex. 12 340 au lieu de 13 240) : écart de 900 €.
      const mCompta = Math.round(montantAnomalie(1.2) / 10000) * 10000 + 2340 + rnd.entier(0, 5) * 1000;
      const ecartInv = 900;
      const num = cheque++;
      const f = rnd.choix(FOURNISSEURS);
      const d = jour(12, rnd.entier(4, 18));
      const op = ajouter({ libelle: `Chèque n° ${num} ${f}`, libelle_banque: `CHEQUE ${num}`, piece: `CHQ ${num}`, sens: 'decaissement', montant: mCompta, montant_banque: mCompta + ecartInv, date_compta: d, date_banque: ajouterJours(d, 5), contrepartie: '401', contrepartie_libelle: 'Fournisseurs' });
      declarer('erreur_montant', [op],
        `Le chèque n° ${num} est comptabilisé pour ${op.montant} € alors que la banque l'a débité pour ${op.montant_banque} € (erreur de saisie : écart de ${ecartInv} €, multiple de 9 typique d'une inversion de chiffres). Cet écart explique tout ou partie de l'écart du rapprochement.`,
        "Pointage ligne à ligne grand livre / relevé et examen de la souche ou de la copie du chèque (NEP 500).",
        `Débit 401 Fournisseurs / Crédit 512 Banque pour ${ecartInv} € (complément).`);
    },
    rapprochement_faux() {
      const d = jour(12, rnd.entier(6, 22));
      const op = ajouter({ libelle: 'Prélèvement crédit-bail véhicule', libelle_banque: 'PRLV SEPA LEASEFI CREDIT BAIL', sens: 'decaissement', montant: montantAnomalie(0.6), date_compta: null, date_banque: d, contrepartie: '6122', contrepartie_libelle: 'Crédit-bail mobilier' });
      omis.push(op.id);
      if (niveau === 'confirme') libelle_ecart = 'Régularisation en cours (à identifier)';
      declarer('rapprochement_faux', [op],
        `L'état de rapprochement du client ne boucle pas : il présente un écart non justifié${niveau === 'confirme' ? ' masqué sous une ligne « régularisation en cours »' : ''}. Il provient notamment du prélèvement du ${dateFr(d)} présent sur le relevé, ni comptabilisé ni repris en rapprochement. Un rapprochement qui ne boucle pas ne justifie pas le solde de banque.`,
        "Contrôle arithmétique de l'état de rapprochement, validation des soldes avec le grand livre et le relevé (ou la confirmation bancaire, NEP 505), puis pointage exhaustif pour expliquer l'écart.",
        `Débit 6122 Crédit-bail mobilier / Crédit 512 Banque pour ${op.montant} €, puis rapprochement à refaire.`);
    },
    beneficiaire_inhabituel() {
      const b = rnd.choix(BENEFICIAIRES);
      const d = jour(12, rnd.entier(19, 27));
      const montant = niveau === 'confirme' ? arrondi(Math.round(echelle / 500) * 500 + 480) : Math.max(5000, Math.round(echelle / 5000) * 5000);
      const op = ajouter({ libelle: `Virement émis ${b} - prestation`, libelle_banque: `VIR INTL ${b}`, piece: 'Sans facture', sens: 'decaissement', montant, date_compta: d, date_banque: d, contrepartie: '6226', contrepartie_libelle: 'Honoraires' });
      declarer('beneficiaire_inhabituel', [op],
        `Virement de ${op.montant} € émis le ${dateFr(d)} vers ${b}, tiers absent des fournisseurs habituels, sans facture et en toute fin d'exercice. L'opération présente des caractéristiques de risque de fraude (détournement, charge fictive).`,
        "Revue des décaissements significatifs ou inhabituels, obtention de la facture, du contrat et de l'autorisation, vérification de l'existence du tiers et du RIB (NEP 240, NEP 500).",
        "Pas de correction automatique : à défaut de justificatif, reclasser en compte d'attente 467 / débiteurs divers et apprécier la dépréciation ; informer la direction, voire la gouvernance.");
    },
  };

  const parNiveau = {
    debutant: { nb: 3, types: ['cheque_ancien', 'virement_non_comptabilise', 'frais_non_comptabilises', 'double_comptabilisation', 'beneficiaire_inhabituel'] },
    intermediaire: { nb: 4, types: ['cheque_ancien', 'suspens_ancien', 'virement_non_comptabilise', 'frais_non_comptabilises', 'double_comptabilisation', 'cut_off', 'erreur_montant', 'beneficiaire_inhabituel'] },
    confirme: { nb: rnd.entier(4, 5), types: Object.keys(fabriques) },
  }[niveau];
  // Un écart de montant rend déjà le rapprochement faux : on ne cumule pas les deux types.
  let choisis = rnd.melanger(parNiveau.types);
  if (choisis.indexOf('erreur_montant') < choisis.indexOf('rapprochement_faux')) choisis = choisis.filter((t) => t !== 'rapprochement_faux');
  else choisis = choisis.filter((t) => t !== 'erreur_montant');
  choisis.slice(0, parNiveau.nb).forEach((t) => fabriques[t]());

  return {
    entreprise: { nom: e.nom, secteur: e.secteur, forme_juridique: e.forme, effectif: e.effectif, contexte: e.contexte },
    exercice: { periode_debut: debut, cloture: fin },
    balance_ouverture,
    operations: rnd.melanger(operations),
    rapprochement: { omis, libelle_ecart },
    anomalies,
  };
}
