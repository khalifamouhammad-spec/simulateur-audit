// Constantes de l'application : référentiels, cycles, niveaux, types d'anomalies.

export const REFERENTIELS = {
  pcg: {
    id: 'pcg',
    libelle: 'PCG français / normes NEP',
    planComptable: 'Plan comptable général français',
    normes: 'NEP',
    compteBanque: '512',
    devise: 'EUR',
    disponible: true,
  },
  syscohada: {
    id: 'syscohada',
    libelle: 'SYSCOHADA révisé / normes ISA (à venir)',
    planComptable: 'SYSCOHADA révisé',
    normes: 'ISA',
    compteBanque: '521',
    devise: 'XOF',
    disponible: false,
  },
};

// Les cycles futurs s'ajoutent ici puis dans js/cycles/index.js.
export const CYCLES = [
  { id: 'tresorerie', libelle: 'Trésorerie', disponible: true },
  { id: 'ventes', libelle: 'Ventes / clients', disponible: false },
  { id: 'achats', libelle: 'Achats / fournisseurs', disponible: false },
  { id: 'stocks', libelle: 'Stocks', disponible: false },
  { id: 'immobilisations', libelle: 'Immobilisations', disponible: false },
  { id: 'personnel', libelle: 'Personnel', disponible: false },
  { id: 'mission_complete', libelle: 'Mission complète avec opinion', disponible: false },
];

export const NIVEAUX = {
  debutant: { id: 'debutant', libelle: 'Débutant', description: 'Anomalies visibles, montants élevés' },
  intermediaire: { id: 'intermediaire', libelle: 'Intermédiaire', description: 'Anomalies variées' },
  confirme: { id: 'confirme', libelle: 'Confirmé', description: 'Anomalies subtiles, proches des seuils' },
};

export const TYPES_ANOMALIE = {
  cheque_ancien: 'Chèque émis non encaissé depuis plus d\'un an',
  suspens_ancien: 'Suspens ancien non régularisé',
  virement_non_comptabilise: 'Virement reçu non comptabilisé',
  frais_non_comptabilises: 'Frais bancaires non comptabilisés',
  double_comptabilisation: 'Opération comptabilisée deux fois',
  cut_off: 'Erreur de cut-off (séparation des exercices)',
  erreur_montant: 'Erreur de montant entre comptabilité et banque',
  rapprochement_faux: 'Rapprochement bancaire faux (écart non justifié)',
  beneficiaire_inhabituel: 'Virement vers un bénéficiaire inhabituel',
  autre: 'Autre',
};

export const MODELE_GROQ_DEFAUT = 'llama-3.3-70b-versatile';
export const URL_GROQ = 'https://api.groq.com/openai/v1';
