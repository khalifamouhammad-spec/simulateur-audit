// Configuration des cycles de la section D : comptes du cycle, programme de travail standard et
// outils propres (voir sections/outils.js). L'écran est le même pour tous (sections/cycle.js).
import { TRESORERIE } from './tresorerie.js';

const P = (titre, assertion, norme) => ({ titre, assertion, norme });

export const VENTES = {
  id: 'ventes', code: 'D2', libelle: 'Ventes / clients',
  comptes: [['411000', 'Clients'], ['707000', 'Ventes de marchandises'], ['706000', 'Prestations de services'], ['704000', 'Travaux'], ['701000', 'Ventes de produits finis'], ['445710', 'TVA collectée'], ['740000', "Subventions d'exploitation"]],
  outils: ['balanceClients', 'lettrageClients', 'circularisationClients', 'avoirs', 'annonces', 'testsFec'],
  programme: [
    P("Rapprocher le chiffre d'affaires comptabilisé de la facturation et de la TVA collectée", 'Exhaustivité', '500'),
    P('Tester la séparation des exercices : dernières factures de décembre et premières de janvier, rapprochées des bons de livraison', 'Séparation des exercices', '500'),
    P('Revoir les avoirs émis après la clôture et rattacher à l\'exercice ceux dont le fait générateur est antérieur', 'Séparation des exercices', '560'),
    P('Analyser la balance âgée clients et les encaissements postérieurs à la clôture', 'Évaluation', '500'),
    P('Apprécier les dépréciations : créances échues, litiges, clients en procédure collective', 'Évaluation', '540'),
    P('Circulariser les principaux clients et les soldes inhabituels', 'Réalité', '505'),
    P("Revoir les ventes inhabituelles de fin d'exercice : nouveaux clients, montants ronds, saisie par un utilisateur inhabituel", 'Réalité', '240'),
    P('Analyser les soldes clients créditeurs et les comptes non lettrés', 'Présentation', '500'),
    P("Revue analytique du chiffre d'affaires mensuel et de la marge", 'Exhaustivité', '520'),
  ],
};

export const ACHATS = {
  id: 'achats', code: 'D3', libelle: 'Achats / fournisseurs',
  comptes: [['401000', 'Fournisseurs'], ['408100', 'Factures non parvenues'], ['404000', "Fournisseurs d'immobilisations"], ['607000', 'Achats de marchandises'], ['601000', 'Achats de matières premières'], ['604000', 'Achats de prestations'], ['611000', 'Sous-traitance'], ['622600', 'Honoraires'], ['615000', 'Entretien et réparations'], ['471000', "Compte d'attente"]],
  outils: ['balanceFournisseurs', 'lettrageFournisseurs', 'circularisationFournisseurs', 'factures', 'testsFec'],
  programme: [
    P('Rechercher les passifs non enregistrés : factures reçues et décaissements de janvier-février N+1', 'Exhaustivité', '500'),
    P('Contrôler les factures non parvenues de la clôture et l\'extourne de celles de l\'exercice précédent', 'Exhaustivité', '500'),
    P('Tester la séparation des exercices sur les achats de fin d\'exercice', 'Séparation des exercices', '500'),
    P('Analyser la balance âgée fournisseurs et les soldes débiteurs', 'Présentation', '500'),
    P('Rechercher les doublons de factures et de paiements (même fournisseur, même référence, même montant)', 'Réalité', '500'),
    P('Circulariser les principaux fournisseurs', 'Exhaustivité', '505'),
    P('Revoir les fournisseurs nouveaux ou inhabituels et les paiements sans facture', 'Réalité', '240'),
    P("Tester les écritures manuelles : opérations diverses, saisies le week-end, comptes d'attente, utilisateurs inhabituels", 'Réalité', '240'),
    P('Revue analytique des achats et des charges externes', 'Exhaustivité', '520'),
  ],
};

export const STOCKS = {
  id: 'stocks', code: 'D4', libelle: 'Stocks',
  comptes: [['370000', 'Stocks de marchandises'], ['310000', 'Matières premières'], ['603700', 'Variation des stocks de marchandises'], ['603100', 'Variation des stocks de matières']],
  outils: ['inventaire', 'testsFec'],
  programme: [
    P("Assister à l'inventaire physique et réaliser des comptages par sondage", 'Réalité', '501'),
    P("Rapprocher l'état de stock valorisé du procès-verbal d'inventaire et de la comptabilité", 'Exhaustivité', '501'),
    P('Tester la valorisation : coûts unitaires rapprochés des dernières factures d\'achat', 'Évaluation', '500'),
    P('Identifier les articles à rotation lente ou obsolètes et apprécier leur dépréciation', 'Évaluation', '540'),
    P('Tester la séparation des exercices sur les dernières entrées et sorties', 'Séparation des exercices', '500'),
    P('Revue analytique : rotation des stocks et taux de marge', 'Évaluation', '520'),
  ],
};

export const IMMOBILISATIONS = {
  id: 'immobilisations', code: 'D5', libelle: 'Immobilisations',
  comptes: [['213500', 'Installations générales'], ['215400', 'Matériel industriel'], ['218200', 'Matériel de transport'], ['218300', 'Matériel de bureau'], ['281540', 'Amortissements du matériel industriel'], ['681120', 'Dotations aux amortissements'], ['471000', "Compte d'attente"]],
  outils: ['tableauImmobilisations', 'testsFec'],
  programme: [
    P('Rapprocher le tableau de variation des immobilisations de la balance', 'Exhaustivité', '500'),
    P("Contrôler les acquisitions sur facture et le respect des critères de comptabilisation d'un actif", 'Classification', '500'),
    P('Contrôler les cessions et mises au rebut : sortie de l\'actif, calcul du résultat de cession', 'Réalité', '500'),
    P('Recalculer les dotations aux amortissements par catégorie', 'Évaluation', '500'),
    P("Vérifier l'existence physique des principales immobilisations", 'Réalité', '500'),
    P("Analyser le compte d'attente 471 et les encaissements inhabituels", 'Classification', '500'),
  ],
};

export const PERSONNEL = {
  id: 'personnel', code: 'D6', libelle: 'Personnel',
  comptes: [['641100', 'Salaires et appointements'], ['645100', "Cotisations à l'URSSAF"], ['421000', 'Rémunérations dues'], ['431000', 'Sécurité sociale'], ['428200', 'Congés à payer'], ['438200', 'Charges sociales sur congés à payer'], ['641200', 'Congés payés']],
  outils: ['recapitulatifPaie', 'testsFec'],
  programme: [
    P('Rapprocher les journaux de paie de la comptabilité', 'Exhaustivité', '500'),
    P('Revue analytique mensuelle des salaires, des effectifs et du taux de charges sociales', 'Exhaustivité', '520'),
    P('Rapprocher les charges sociales des déclarations et des paiements', 'Exhaustivité', '500'),
    P('Contrôler la provision pour congés payés (droits acquis, salaire de référence, charges)', 'Évaluation', '540'),
    P('Contrôler le rattachement à l\'exercice des charges de décembre (salaires, charges, primes)', 'Séparation des exercices', '500'),
    P('Tester les entrées, sorties et augmentations sur pièces', 'Réalité', '500'),
  ],
};

export const FISCAL = {
  id: 'fiscal', code: 'D7', libelle: 'Fiscal',
  comptes: [['445710', 'TVA collectée'], ['445660', 'TVA déductible'], ['445510', 'TVA à décaisser'], ['444000', 'Impôt sur les bénéfices'], ['695000', 'Impôt sur les bénéfices (charge)']],
  outils: ['coherenceTva', 'testsFec'],
  programme: [
    P("Contrôler la cohérence entre chiffre d'affaires taxable, taux applicables et TVA collectée", 'Exhaustivité', '520'),
    P('Rapprocher les déclarations de TVA de la comptabilité', 'Exhaustivité', '500'),
    P("Recalculer l'impôt sur les sociétés et vérifier le taux appliqué", 'Évaluation', '500'),
    P('Revoir les correspondances avec l\'administration et les risques fiscaux', 'Exhaustivité', '500'),
    P('Vérifier le respect des échéances déclaratives et de paiement', 'Présentation', '500'),
  ],
};

export const CAPITAUX = {
  id: 'capitaux', code: 'D8', libelle: 'Capitaux propres et provisions',
  comptes: [['101300', 'Capital'], ['102000', 'Fonds associatifs'], ['106800', 'Réserves'], ['110000', 'Report à nouveau'], ['120000', 'Résultat'], ['164000', 'Emprunts'], ['455000', "Comptes courants d'associés"]],
  outils: ['capitauxPropres', 'testsFec'],
  programme: [
    P('Rapprocher la variation des capitaux propres des procès-verbaux d\'assemblée', 'Réalité', '500'),
    P("Contrôler l'affectation du résultat de l'exercice précédent", 'Présentation', '500'),
    P("Rapprocher les emprunts des tableaux d'amortissement et des confirmations bancaires", 'Exhaustivité', '505'),
    P("Contrôler les comptes courants d'associés et leurs conventions", 'Droits et obligations', '550'),
    P('Recenser les litiges et risques et apprécier les provisions', 'Exhaustivité', '540'),
    P('Recenser les engagements hors bilan (cautions, crédit-bail, garanties)', 'Présentation', '500'),
  ],
};

export const CONFIGS_CYCLES = { tresorerie: TRESORERIE, ventes: VENTES, achats: ACHATS, stocks: STOCKS, immobilisations: IMMOBILISATIONS, personnel: PERSONNEL, fiscal: FISCAL, capitaux: CAPITAUX };
