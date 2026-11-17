// Plan de comptes utilisé par le générateur (PCG, comptes à 6 chiffres), journaux,
// colonnes du FEC et paramètres économiques par secteur.

export const JOURNAUX = { AN: 'À-nouveaux', VE: 'Ventes', AC: 'Achats', BQ: 'Banque', PA: 'Paie', OD: 'Opérations diverses' };

// Les 18 colonnes réglementaires du FEC, dans l'ordre. Chaque ligne stockée contient en plus
// deux colonnes internes (hors export) : l'utilisateur de saisie et la date de saisie.
export const COLONNES_FEC = ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
  'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise'];
/** Comptes de banque (y compris les sous-comptes d'un FEC importé). */
export const estBanque = (compte) => /^512/.test(String(compte));
export const COL = Object.fromEntries([...COLONNES_FEC, 'Utilisateur', 'DateSaisie'].map((nom, i) => [nom, i]));

export const PLAN = {
  101300: 'Capital souscrit - appelé, versé', 102000: 'Fonds associatifs sans droit de reprise', 106800: 'Autres réserves',
  110000: 'Report à nouveau (solde créditeur)', 119000: 'Report à nouveau (solde débiteur)',
  120000: "Résultat de l'exercice (bénéfice)", 129000: "Résultat de l'exercice (perte)", 164000: 'Emprunts auprès des établissements de crédit',
  213500: 'Installations générales, agencements', 215400: 'Matériel industriel', 218200: 'Matériel de transport', 218300: 'Matériel de bureau et informatique',
  281350: 'Amortissements des installations générales', 281540: 'Amortissements du matériel industriel',
  281820: 'Amortissements du matériel de transport', 281830: 'Amortissements du matériel de bureau et informatique',
  310000: 'Matières premières', 370000: 'Stocks de marchandises',
  401000: 'Fournisseurs', 404000: "Fournisseurs d'immobilisations", 408100: 'Fournisseurs - factures non parvenues', 411000: 'Clients',
  421000: 'Personnel - rémunérations dues', 428200: 'Dettes provisionnées pour congés à payer', 431000: 'Sécurité sociale (URSSAF)',
  438200: 'Charges sociales sur congés à payer', 444000: 'État - impôt sur les bénéfices', 445510: 'TVA à décaisser',
  445620: 'TVA déductible sur immobilisations', 445660: 'TVA déductible sur autres biens et services', 445670: 'Crédit de TVA à reporter',
  445710: 'TVA collectée', 445860: 'TVA sur factures non parvenues', 455000: 'Associés - comptes courants', 471000: "Compte d'attente",
  512000: 'Banque',
  601000: 'Achats de matières premières', 603100: 'Variation des stocks de matières premières', 603700: 'Variation des stocks de marchandises',
  604000: "Achats d'études et prestations de services", 606100: 'Fournitures non stockables (eau, énergie)', 606400: 'Fournitures administratives',
  607000: 'Achats de marchandises', 611000: 'Sous-traitance générale', 613200: 'Locations immobilières', 615000: 'Entretien et réparations',
  616000: "Primes d'assurance", 622600: 'Honoraires', 623000: 'Publicité, publications, relations publiques', 624100: 'Transports sur achats',
  625100: 'Voyages et déplacements', 626000: 'Frais postaux et de télécommunications', 627000: 'Services bancaires et assimilés',
  641100: 'Salaires et appointements', 641200: 'Congés payés', 645100: "Cotisations à l'URSSAF", 645800: 'Charges sociales sur congés à payer',
  661160: 'Intérêts des emprunts', 681120: 'Dotations aux amortissements des immobilisations corporelles', 695000: 'Impôt sur les bénéfices',
  701000: 'Ventes de produits finis', 704000: 'Travaux', 706000: 'Prestations de services', 707000: 'Ventes de marchandises',
  740000: "Subventions d'exploitation", 758000: 'Produits divers de gestion courante',
};

export const TAUX = { cotisationsSalariales: 0.22, cotisationsPatronales: 0.42, is: 0.25, tvaNormale: 0.2 };

/**
 * Paramètres économiques par secteur, en proportion du chiffre d'affaires.
 * achats : achats consommés ; sousTraitance ; externes : autres charges externes ; personnel : coût chargé.
 */
export const SECTEURS_MOTEUR = {
  commerce: { vente: '707000', tvaVente: 0.2, achat: '607000', stock: '370000', varStock: '603700', achats: 0.66, sousTraitance: 0, externes: 0.10, personnel: 0.16, joursStock: 45, immo: 0.10, delais: [30, 30, 45] },
  btp: { vente: '704000', tvaVente: 0.2, achat: '601000', stock: '310000', varStock: '603100', achats: 0.30, sousTraitance: 0.16, externes: 0.12, personnel: 0.35, joursStock: 20, immo: 0.16, delais: [30, 45, 60] },
  restauration: { vente: '706000', tvaVente: 0.1, achat: '607000', stock: '370000', varStock: '603700', achats: 0.30, sousTraitance: 0, externes: 0.18, personnel: 0.43, joursStock: 8, immo: 0.22, delais: [1, 2, 30] },
  services: { vente: '706000', tvaVente: 0.2, achat: '604000', stock: null, varStock: null, achats: 0.05, sousTraitance: 0, externes: 0.21, personnel: 0.68, joursStock: 0, immo: 0.05, delais: [30, 45, 60] },
  industrie: { vente: '701000', tvaVente: 0.2, achat: '601000', stock: '310000', varStock: '603100', achats: 0.44, sousTraitance: 0, externes: 0.14, personnel: 0.34, joursStock: 40, immo: 0.25, delais: [30, 45, 60] },
  association: { vente: '706000', tvaVente: 0, achat: '604000', stock: null, varStock: null, achats: 0.08, sousTraitance: 0, externes: 0.20, personnel: 0.66, joursStock: 0, immo: 0.08, delais: [30, 30, 45], subventions: 0.35, sansTva: true, sansIs: true },
};

// Charges externes : part du budget, fréquence annuelle fixe (ou null : variable), TVA.
export const NATURES_EXTERNES = [
  { compte: '613200', part: 0.22, frequence: 12, tva: true, lib: 'Loyer', noms: ['SCI Foncière du Centre', 'SCI Les Tilleuls', 'Immobilière des Quais'] },
  { compte: '606100', part: 0.10, frequence: 12, tva: true, lib: 'Électricité et gaz', noms: ['Énergies du Territoire', 'Électricité Services Pro'] },
  { compte: '626000', part: 0.05, frequence: 12, tva: true, lib: 'Téléphonie et internet', noms: ['Télécom Entreprises', 'Réseau Pro Connect'] },
  { compte: '616000', part: 0.08, frequence: 4, tva: false, lib: 'Assurance multirisque', noms: ['Mutuelle Assurances du Sud', 'Assurances Générales Rhodaniennes'] },
  { compte: '622600', part: 0.11, frequence: null, tva: true, lib: 'Honoraires', noms: ['Cabinet Expertise Marceau', 'Maître Delorme Avocat', 'Conseil RH Partenaires'] },
  { compte: '623000', part: 0.08, frequence: null, tva: true, lib: 'Publicité', noms: ['Agence Pixel & Encre', 'Imprimerie Garonne'] },
  { compte: '624100', part: 0.10, frequence: null, tva: true, lib: 'Transport', noms: ['Transports Kerlouan', 'Messagerie Express Ouest'] },
  { compte: '625100', part: 0.07, frequence: null, tva: true, lib: 'Déplacements', noms: ['Agence Voyages Affaires', 'Hôtels & Séjours Pro'] },
  { compte: '615000', part: 0.12, frequence: null, tva: true, lib: 'Entretien et maintenance', noms: ['Maintenance Industrielle Sud', 'Propreté Services Ouest', 'Dépannage Technique Plus'] },
  { compte: '606400', part: 0.07, frequence: null, tva: true, lib: 'Fournitures de bureau', noms: ['Bureau Fournitures Direct', 'Papeterie Centrale'] },
];

// Immobilisations de départ : part du budget d'investissement, durée d'amortissement, âge moyen.
export const CATEGORIES_IMMO = [
  { compte: '213500', amort: '281350', part: 0.30, duree: 10, age: 4, lib: 'Agencements des locaux' },
  { compte: '215400', amort: '281540', part: 0.40, duree: 7, age: 3, lib: 'Matériel et outillage' },
  { compte: '218200', amort: '281820', part: 0.15, duree: 5, age: 2, lib: 'Véhicule utilitaire' },
  { compte: '218300', amort: '281830', part: 0.15, duree: 4, age: 2, lib: 'Matériel informatique' },
];

const PATRONYMES = ['Durand', 'Lemoine', 'Bertin', 'Roux', 'Pelletier', 'Colin', 'Fabre', 'Marchand', 'Girard', 'Besson', 'Charpentier', 'Meunier', 'Barbier', 'Perrin', 'Renaud', 'Gaillard', 'Lacroix', 'Vasseur', 'Tessier', 'Morel', 'Aubert', 'Poulain', 'Joly', 'Carpentier', 'Hamon', 'Leclerc', 'Brunet', 'Maillard', 'Collet', 'Picard'];
const FORMES = ['SARL', 'SAS', 'Ets', 'Groupe', 'Société', 'SCI', 'EURL'];
const ACTIVITES = ['Distribution', 'Industries', 'Services', 'Bâtiment', 'Logistique', 'Négoce', 'Équipements', 'Conseil', 'Habitat', 'Automobiles', 'Matériaux', 'Agencement'];
const COLLECTIVITES = ['Mairie de Vernay', 'Communauté de communes du Val', 'Lycée Jean Moulin', 'Centre hospitalier de Brissac', 'Office HLM du Plateau'];

/** Fabrique des noms de tiers fictifs, sans doublon. */
export function fabriqueNoms(rnd, dejaPris = []) {
  const pris = new Set(dejaPris);
  return () => {
    for (let essai = 0; essai < 50; essai++) {
      const tirage = rnd();
      const nom = tirage < 0.08 ? rnd.choix(COLLECTIVITES)
        : tirage < 0.55 ? `${rnd.choix(FORMES)} ${rnd.choix(PATRONYMES)}`
        : `${rnd.choix(PATRONYMES)} ${rnd.choix(ACTIVITES)}`;
      if (!pris.has(nom)) { pris.add(nom); return nom; }
    }
    const nom = `Société ${rnd.choix(PATRONYMES)} ${pris.size}`;
    pris.add(nom);
    return nom;
  };
}
