// Configuration du cycle trésorerie : comptes, programme de travail standard, outils propres au cycle.
// Les autres cycles (phase 6) suivent la même structure.
export const TRESORERIE = {
  id: 'tresorerie', code: 'D1', libelle: 'Trésorerie', banque: true,
  outils: ['circularisationBanque', 'testsFec'],
  comptes: [['512000', 'Banque'], ['627000', 'Services bancaires'], ['661160', 'Intérêts des emprunts'], ['164000', 'Emprunts'], ['471000', "Compte d'attente"], ['455000', 'Comptes courants d\'associés']],
  programme: [
    { titre: "Obtenir l'état de rapprochement bancaire au 31/12 et en contrôler l'exactitude arithmétique", assertion: 'Réalité', norme: '500' },
    { titre: "Valider le solde comptable de l'état avec le grand livre 512 et le solde bancaire avec le relevé au 31/12", assertion: 'Réalité', norme: '500' },
    { titre: 'Vérifier l\'apurement des suspens sur le relevé de janvier N+1', assertion: 'Réalité', norme: '500' },
    { titre: "Analyser l'ancienneté des suspens : chèques émis depuis plus d'un an, remises non créditées", assertion: 'Évaluation', norme: '500' },
    { titre: 'Vérifier que les opérations du relevé non comptabilisées (frais, agios, virements) sont régularisées à la clôture', assertion: 'Exhaustivité', norme: '500' },
    { titre: 'Circulariser les banques : soldes, emprunts, engagements, personnes habilitées', assertion: 'Exhaustivité', norme: '505' },
    { titre: 'Tester la séparation des exercices sur les mouvements de fin décembre et de début janvier', assertion: 'Séparation des exercices', norme: '500' },
    { titre: 'Revoir les décaissements significatifs ou inhabituels : bénéficiaires inconnus, montants ronds, paiements fractionnés sous le seuil de double signature', assertion: 'Réalité', norme: '240' },
    { titre: "Analyser le compte d'attente 471 et les comptes courants d'associés", assertion: 'Classification', norme: '500' },
    { titre: "Recouper les intérêts d'emprunt avec le capital restant dû et contrôler la présentation des soldes créditeurs de banque", assertion: 'Présentation', norme: '520' },
  ],
};
