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
