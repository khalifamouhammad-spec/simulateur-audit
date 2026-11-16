# Simulateur d'audit

Simulateur de missions d'audit légal pour s'entraîner sur des cas réalistes.

## Lancer l'application

L'application est statique (HTML / CSS / JavaScript, sans dépendance). Elle doit être servie par un petit serveur web :

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000.

La clé API Groq se saisit dans l'écran **Paramètres** ; elle est stockée uniquement dans le navigateur (localStorage). Sans clé, le bouton « Cas hors-ligne » génère des cas sans IA.

## Tests du moteur comptable

```bash
node tests/test-moteur.mjs
```

## Principe de fiabilité

L'IA ne fournit aucun solde ni total. Elle propose une balance de départ et une liste d'opérations de banque (date comptable, date en banque, montant, contrepartie). Le code :

- vérifie que chaque écriture est équilibrée ;
- calcule le grand livre 512, le relevé, l'état de rapprochement, la balance, le bilan et le compte de résultat ;
- contrôle que chaque anomalie déclarée correspond bien aux données ;
- rejette le cas et le fait régénérer s'il est incohérent.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `js/config.js` | Référentiels (PCG/NEP, SYSCOHADA/ISA), cycles, niveaux, types d'anomalies |
| `js/compta.js` | Moteur comptable générique |
| `js/generation.js` | Génération par IA, contrôle, rejet et régénération |
| `js/correction.js` | Comparaison automatique, barème, commentaire de l'IA |
| `js/cycles/` | Un jeu de fichiers par cycle (trésorerie pour l'instant) |
| `js/ui-*.js` | Écrans : accueil, mission, historique, paramètres |
| `js/storage.js` | Sauvegarde locale (seul fichier à changer pour passer à Firebase) |

Pour ajouter un cycle : créer ses fichiers dans `js/cycles/`, l'enregistrer dans `js/cycles/index.js` et l'activer dans `js/config.js`.
