# Simulateur d'audit

Simulateur de missions d'audit légal pour s'entraîner sur des cas réalistes.

Logiciel d'audit d'entraînement (dossier, feuilles de travail, programmes, revue, rapport) sur des clients fictifs dotés d'un FEC. Développement par phases : **phase 1 (socle) terminée**.

Le premier simulateur (cycle trésorerie seul) reste disponible dans [`v1/`](v1/).

## Lancer l'application

Application statique (HTML / CSS / JavaScript, sans dépendance), à servir par un petit serveur web :

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000 (et http://localhost:8000/v1/ pour le premier simulateur).

La clé API Groq se saisit dans **Paramètres** ; elle est stockée uniquement dans le navigateur (IndexedDB), jamais dans le code ni dans le dépôt.

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
| `js/moteur/anomalies/` | Bibliothèque d'anomalies types, une par fichier de cycle | 2 |
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
