# Fulbert API Server

API serveur sécurisée pour Fulbert Asky Ingénierie. Cette API gère l'authentification et les opérations administratives de manière sécurisée.

## Architecture de sécurité

### Avant (non sécurisé)
```
Navigateur → Frontend → JSONBin (clés exposées)
```

### Après (sécurisé)
```
Navigateur → Frontend → API Serveur → JSONBin (clés protégées)
```

## Fonctionnalités

- ✅ Authentification serveur avec cookies HttpOnly et Secure
- ✅ Sessions sécurisées avec expiration
- ✅ Rate limiting pour prévenir les attaques brute force
- ✅ CORS configuré pour le frontend
- ✅ Helmet pour les en-têtes de sécurité HTTP
- ✅ Clés JSONBin uniquement sur le serveur
- ✅ Endpoints API sécurisés pour l'administration
- ✅ Endpoints publics pour les formulaires de contact

## Installation

```bash
npm install
```

## Configuration

Créer un fichier `.env` à la racine du projet :

```env
# Port du serveur
PORT=3001

# Clés JSONBin (NE JAMAIS PARTAGER)
JSONBIN_API_URL=https://api.jsonbin.io/v3/b/VOTRE_BIN_ID
JSONBIN_MASTER_KEY=VOTRE_MASTER_KEY
JSONBIN_ACCESS_KEY=VOTRE_ACCESS_KEY

# Clé secrète pour les sessions (GÉNÉRER UNE NOUVELLE CLÉ)
SESSION_SECRET=votre_clé_secrète_très_longue_et_complexe_ici

# Identifiants admin (CHANGER EN PRODUCTION)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=votre_mot_de_passe_secure

# URL du frontend (pour CORS)
FRONTEND_URL=https://fulbert-website.surge.sh
```

## Démarrage

### Développement
```bash
npm run dev
```

### Production
```bash
npm start
```

## Endpoints API

### Santé
- `GET /health` - Vérifier si le serveur fonctionne

### Authentification
- `POST /api/admin/login` - Connexion administrateur
- `POST /api/admin/logout` - Déconnexion
- `GET /api/admin/check` - Vérifier l'authentification

### Données (protégées)
- `GET /api/data` - Récupérer toutes les données
- `PUT /api/data` - Mettre à jour toutes les données

### Clients (protégées)
- `GET /api/clients` - Récupérer les clients
- `POST /api/clients` - Ajouter un client
- `PUT /api/clients/:id` - Mettre à jour un client
- `DELETE /api/clients/:id` - Supprimer un client

### Projets (protégés)
- `GET /api/projects` - Récupérer les projets
- `POST /api/projects` - Ajouter un projet

### Candidatures (protégées)
- `GET /api/applications` - Récupérer les candidatures de contact
- `GET /api/job-applications` - Récupérer les candidatures emploi

### Public (sans authentification)
- `POST /api/public/contact` - Soumettre un formulaire de contact
- `POST /api/public/job-application` - Soumettre une candidature emploi

## Déploiement

### Option 1: Railway
```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Initialiser le projet
railway init

# Déployer
railway up
```

### Option 2: Vercel
```bash
# Installer Vercel CLI
npm install -g vercel

# Déployer
vercel
```

### Option 3: Render
1. Créer un compte sur [render.com](https://render.com)
2. Créer un nouveau Web Service
3. Connecter le repository GitHub
4. Configurer les variables d'environnement
5. Déployer

### Option 4: Heroku
```bash
# Installer Heroku CLI
npm install -g heroku

# Créer l'app
heroku create

# Configurer les variables d'environnement
heroku config:set PORT=3001
heroku config:set JSONBIN_API_URL=...
heroku config:set JSONBIN_MASTER_KEY=...
heroku config:set JSONBIN_ACCESS_KEY=...
heroku config:set SESSION_SECRET=...
heroku config:set ADMIN_USERNAME=...
heroku config:set ADMIN_PASSWORD=...
heroku config:set FRONTEND_URL=https://fulbert-website.surge.sh

# Déployer
git push heroku main
```

## Sécurité

### Mesures implémentées
- ✅ Cookies HttpOnly (inaccessibles via JavaScript)
- ✅ Cookies Secure (uniquement transmis via HTTPS en production)
- ✅ SameSite=strict (protection CSRF)
- ✅ Rate limiting (100 requêtes/15min, 5 tentatives login/15min)
- ✅ Helmet (en-têtes de sécurité HTTP)
- ✅ Validation des données
- ✅ Expiration des sessions (24 heures)

### Recommandations pour la production
1. **Changer la clé secrète de session** : Générer une clé aléatoire longue et complexe
2. **Utiliser des mots de passe forts** : Au moins 12 caractères, mélange majuscules/minuscules/chiffres/symboles
3. **Activer HTTPS** : Obligatoire pour les cookies Secure
4. **Surveiller les logs** : Journaliser les connexions et activités suspectes
5. **Sauvegardes régulières** : Sauvegarder les données JSONBin
6. **Mettre à jour les dépendances** : `npm audit fix` régulièrement

## Configuration du frontend

Après déploiement de l'API, mettre à jour le fichier `.env.local` du frontend :

```env
NEXT_PUBLIC_API_URL=https://votre-api-url.com
```

## Support

Pour toute question ou problème, contactez l'administrateur système.
