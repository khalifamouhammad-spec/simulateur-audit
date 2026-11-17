# Simulateur d'audit

Simulateur de missions d'audit légal pour s'entraîner sur des cas réalistes.

Logiciel d'audit d'entraînement (dossier, feuilles de travail, programmes, revue, rapport) sur des clients fictifs dotés d'un FEC. Développement par phases : **phases 1 à 6 terminées** (socle, moteur FEC, planification, cycle trésorerie et ajustements, correction, tous les cycles).

Le premier simulateur (cycle trésorerie seul) reste disponible dans [`v1/`](v1/).

## Lancer l'application

Application statique (HTML / CSS / JavaScript, sans dépendance), à servir par un petit serveur web :

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000 (et http://localhost:8000/v1/ pour le premier simulateur).

La clé API Groq se saisit dans **Paramètres** ; elle est stockée uniquement dans le navigateur (IndexedDB), jamais dans le code ni dans le dépôt.

## Tests du moteur

```bash
node tests/test-fec.mjs
node tests/test-analytique.mjs
node tests/test-banque.mjs
node tests/test-correction.mjs
node tests/test-outils.mjs
```

Génère des clients pour tous les secteurs, tailles et difficultés et contrôle : écritures équilibrées, numérotation continue, lettrage, bilan équilibré, résultat identique au bilan et au compte de résultat, à-nouveaux de N égaux à la clôture de N-1, export réglementaire.

## Qui fait quoi

- **L'IA** rédige le scénario (fiche client, contexte, paramètres d'activité, anomalies à injecter), les pièces justificatives à la demande, et joue le manager en revue.
- **Le code** génère le FEC de façon déterministe, injecte les anomalies, vérifie l'équilibre de chaque écriture et calcule balance, bilan et compte de résultat.
- **Le corrigé** est stocké à part et n'est lu qu'après la clôture de la mission.

## Architecture

| Fichier | Rôle | Phase |
| --- | --- | --- |
| `js/app.js` | Routage (`#/`, `#/parametres`, `#/dossier/<id>/<code>`) | 1 |
| `js/config.js` | Référentiels, secteurs, tailles, statuts, arborescence du dossier | 1 |
| `js/db.js` | IndexedDB (seul point d'accès au stockage) | 1 |
| `js/dossiers.js` | Création d'un dossier, avancement, temps passé | 1 |
| `js/groq.js` | Client de l'API Groq | 1 |
| `js/ui/` | Tableau de bord, dossier (bandeau + arborescence), paramètres | 1 |
| `js/moteur/scenario.js` | Scénario rédigé par l'IA, contrôlé par le code | 2 |
| `js/moteur/generateur-fec.js` | FEC N et N-1 (ventes, achats, paie, immobilisations, trésorerie, TVA, OD) | 2 |
| `js/moteur/anomalies.js` | Bibliothèque d'anomalies types (22 à ce stade) et leur injection | 2 |
| `js/moteur/plan.js` | Plan de comptes, journaux, colonnes du FEC, paramètres par secteur | 2 |
| `js/generation.js` | Enchaîne scénario, génération, contrôles et enregistrement | 2 |
| `js/sections/donnees.js` | Consultation et export du FEC, balance, états financiers | 2 |
| `js/moteur/analytique.js` | Revue analytique N / N-1 : postes, ratios, évolution mensuelle | 3 |
| `js/sections/planification.js` | Fiche client, indépendance, lettre de mission, fiche entreprise, matrice des risques, seuils | 3 |
| `js/sections/controle-interne.js` | Questionnaires de contrôle interne, réponses du client simulées | 3 |
| `js/sections/revue-analytique.js` | Revue analytique à commenter | 3 |
| `js/moteur/banque.js` | Relevés bancaires et état de rapprochement reconstruits à partir du FEC | 4 |
| `js/moteur/pieces.js` | Pièces justificatives construites à partir des écritures | 4 |
| `js/moteur/echantillon.js` | Échantillonnage aléatoire, par unités monétaires, montants élevés | 4 |
| `js/cycles/` | Configuration de chaque cycle (comptes, programme de travail) | 4 et 6 |
| `js/sections/outils.js` | Outils des cycles : balance âgée, lettrage, documents postérieurs, inventaire, immobilisations, paie, TVA, capitaux | 6 |
| `js/sections/cycle.js` | Écran d'un cycle : programme, feuilles de travail, grand livre, banque, pièces | 4 |
| `js/sections/ajustements.js` | Tableau des ajustements proposés | 4 |
| `js/feuilles.js` | Feuilles de travail et pièces (stockage) | 4 |
| `js/correction.js` | Notation : rapprochement des ajustements avec le corrigé, notes par section, commentaire de l'IA | 5 |
| `js/sections/correction.js` | Clôture de la mission et corrigé (H1) | 5 |
| `js/ui/historique.js` | Historique des missions et points faibles | 5 |
| `js/moteur/compta.js` | Contrôles d'équilibre, balance, bilan, compte de résultat | 2 |
| `js/moteur/export-fec.js` | Export `.txt` (tabulations, 18 colonnes) | 2 |
| `js/sections/` | Un module par section du dossier (A à H) | 3 à 7 |
| `js/outils/` | Grand livre, balance âgée, lettrage, échantillonnage, tests FEC | 4 à 7 |

## Structures de données (IndexedDB)

```js
// magasin « dossiers »
{ id, creeLe, modifieLe, statut: 'en_cours' | 'en_revue' | 'cloturee',
  parametres: { secteur, taille, difficulte, nbAnomalies, referentiel, extraitRapport },
  client: { nom, formeJuridique, secteur, ... },
  exercice: { debut, cloture },
  tempsSecondes,
  elements: { A1: { statut: 'a_faire' | 'en_cours' | 'a_revoir' | 'valide', notes }, ... } }

// scénario (phase 2), rangé dans le dossier — sans les anomalies
{ client: { nom, formeJuridique, activite, dirigeants, organisation, systemeInformation },
  activite: { caAnnuel, tauxMarge, nbClients, nbFournisseurs, effectif, saisonnalite, croissance, ... } }

// magasin « corriges » (clé dossierId) — lu uniquement après la clôture
{ dossierId, anomalies: [ { id, type, cycle, assertion, ecritures: [EcritureNum], montant,
                            impactResultat, explication, procedure, correction } ] }

// magasin « fec » (clé [dossierId, exercice]) — une ligne = les 18 colonnes réglementaires
{ dossierId, exercice: 'N' | 'N-1',
  lignes: [ [JournalCode, JournalLib, EcritureNum, EcritureDate, CompteNum, CompteLib, CompAuxNum, CompAuxLib,
             PieceRef, PieceDate, EcritureLib, Debit, Credit, EcritureLet, DateLet, ValidDate, Montantdevise, Idevise] ] }

// magasin « feuilles » (index dossierId)
{ id, dossierId, ref: 'D1-2', cycle, titre, objectif, travail, conclusion,
  refsCroisees: ['D1-1', 'E1'], echantillon, pieces: [documentId], statut, modifieLe }

// magasin « documents » (index dossierId) — pièces justificatives générées
{ id, dossierId, type: 'facture' | 'releve' | 'bon_livraison' | 'contrat' | 'pv_inventaire', ecritureNum, contenu }
```
