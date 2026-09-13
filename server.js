require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const axios = require('axios');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy pour Render et autres services cloud
app.set('trust proxy', 1);

// Configuration CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://fulbert-website.surge.sh',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Sécurité Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  message: 'Trop de requêtes, veuillez réessayer plus tard.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limite à 5 tentatives de connexion par fenêtre
  message: 'Trop de tentatives de connexion, veuillez réessayer plus tard.'
});

app.use(limiter);
app.use(cookieParser());
app.use(express.json());

// Configuration de session
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true en production avec HTTPS
    sameSite: 'none', // 'none' pour cross-domain (Surge + Render)
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  },
  name: 'fulbert_session'
}));

// Configuration JSONBin
const JSONBIN_API_URL = process.env.JSONBIN_API_URL;
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY;
const JSONBIN_ACCESS_KEY = process.env.JSONBIN_ACCESS_KEY;

// Middleware d'authentification
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: 'Accès non autorisé - rôle admin requis' });
  }
  next();
};

// Fonction pour récupérer les données JSONBin
async function getJsonBinData() {
  try {
    const response = await axios.get(JSONBIN_API_URL, {
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_MASTER_KEY,
        'X-Access-Key': JSONBIN_ACCESS_KEY
      }
    });
    return response.data.record;
  } catch (error) {
    console.error('Erreur JSONBin:', error);
    throw error;
  }
}

// Fonction pour mettre à jour les données JSONBin
async function updateJsonBinData(data) {
  try {
    const response = await axios.put(JSONBIN_API_URL, data, {
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_MASTER_KEY,
        'X-Access-Key': JSONBIN_ACCESS_KEY
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erreur JSONBin:', error);
    throw error;
  }
}

// Route de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route de connexion
app.post('/api/admin/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  console.log('Tentative de connexion:', { username, adminUsername, adminPassword: adminPassword ? 'SET' : 'NOT SET' });

  if (username === adminUsername && password === adminPassword) {
    req.session.authenticated = true;
    req.session.username = username;
    req.session.isAdmin = true; // Marquer explicitement comme admin
    req.session.loginTime = new Date().toISOString();

    res.json({
      success: true,
      message: 'Connexion réussie',
      username: username,
      isAdmin: true
    });
  } else {
    console.log('Échec de connexion:', { 
      username, 
      expectedUsername: adminUsername, 
      passwordMatch: password === adminPassword 
    });
    res.status(401).json({ error: 'Identifiants incorrects' });
  }
});

// Route de déconnexion
app.post('/api/admin/logout', requireAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
    }
    res.clearCookie('fulbert_session');
    res.json({ success: true, message: 'Déconnexion réussie' });
  });
});

// Route de vérification de session
app.get('/api/admin/check', (req, res) => {
  if (req.session && req.session.authenticated && req.session.isAdmin) {
    res.json({ 
      authenticated: true, 
      isAdmin: true,
      username: req.session.username,
      loginTime: req.session.loginTime
    });
  } else {
    res.status(401).json({ authenticated: false, isAdmin: false });
  }
});

// Routes API pour les données
app.get('/api/data', requireAuth, async (req, res) => {
  try {
    const data = await getJsonBinData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des données' });
  }
});

app.put('/api/data', requireAuth, async (req, res) => {
  try {
    const data = req.body;
    await updateJsonBinData(data);
    res.json({ success: true, message: 'Données mises à jour' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour des données' });
  }
});

// Routes spécifiques pour les clients
app.get('/api/clients', requireAuth, async (req, res) => {
  try {
    const data = await getJsonBinData();
    res.json(data.clients || []);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des clients' });
  }
});

app.post('/api/clients', requireAuth, async (req, res) => {
  try {
    const data = await getJsonBinData();
    const newClient = { ...req.body, id: Date.now() };
    data.clients = [...(data.clients || []), newClient];
    await updateJsonBinData(data);
    res.json(newClient);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'ajout du client' });
  }
});

app.put('/api/clients/:id', requireAuth, async (req, res) => {
  try {
    const data = await getJsonBinData();
    const index = data.clients.findIndex(c => c.id === parseInt(req.params.id));
    if (index !== -1) {
      data.clients[index] = { ...data.clients[index], ...req.body };
      await updateJsonBinData(data);
      res.json(data.clients[index]);
    } else {
      res.status(404).json({ error: 'Client non trouvé' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du client' });
  }
});

app.delete('/api/clients/:id', requireAuth, async (req, res) => {
  try {
    const data = await getJsonBinData();
    data.clients = data.clients.filter(c => c.id !== parseInt(req.params.id));
    await updateJsonBinData(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la suppression du client' });
  }
});

// Routes spécifiques pour les projets
app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const data = await getJsonBinData();
    res.json(data.projects || []);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des projets' });
  }
});

app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const data = await getJsonBinData();
    const newProject = { ...req.body, id: Date.now() };
    data.projects = [...(data.projects || []), newProject];
    await updateJsonBinData(data);
    res.json(newProject);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'ajout du projet' });
  }
});

// Routes spécifiques pour les candidatures
app.get('/api/applications', requireAuth, async (req, res) => {
  try {
    const data = await getJsonBinData();
    res.json(data.clientRequests || []);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des candidatures' });
  }
});

app.get('/api/job-applications', requireAuth, async (req, res) => {
  try {
    const data = await getJsonBinData();
    res.json(data.jobApplications || []);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des candidatures emploi' });
  }
});

// Routes publiques (sans authentification) pour les formulaires du site
app.post('/api/public/contact', async (req, res) => {
  try {
    const data = await getJsonBinData();
    const newApplication = { 
      ...req.body, 
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      source: 'web',
      status: 'pending',
      responses: []
    };
    data.clientRequests = [...(data.clientRequests || []), newApplication];
    await updateJsonBinData(data);
    res.json({ success: true, message: 'Message envoyé avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

app.post('/api/public/job-application', async (req, res) => {
  try {
    const data = await getJsonBinData();
    const newApplication = { 
      ...req.body, 
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      source: 'web',
      status: 'pending',
      notes: '',
      interviewDates: [],
      feedback: []
    };
    data.jobApplications = [...(data.jobApplications || []), newApplication];
    await updateJsonBinData(data);
    res.json({ success: true, message: 'Candidature envoyée avec succès' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la candidature' });
  }
});

// ═══════════ FULBI AI : passerelle ChatGPT (guichet) ═══════════
// L'application Fulbi envoie la question ici → ce serveur interroge
// l'API officielle d'OpenAI (ChatGPT) → la réponse revient à l'app.
// La clé OpenAI ne quitte JAMAIS ce serveur (architecture sécurisée).

app.post('/api/fulbi/chat', async (req, res) => {
  const { message, userName } = req.body || {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message vide' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Le serveur n'a pas de clé OpenAI configurée (OPENAI_API_KEY dans le .env)"
    });
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              `Tu es Fulbi AI, l'assistant personnel intelligent du téléphone de ${userName || 'Fulbert'}. ` +
              `Réponds toujours en français, de façon concise (4 phrases maximum), directe et utile. ` +
              `Pour les explications, utilise des listes à puces (•) et du gras (**texte**) pour la lisibilité. ` +
              `Si on te demande une action du téléphone (appeler, alarme, torche...), explique brièvement que Fulbi le fait ` +
              `par commande vocale et donne l'info demandée. Ne révèle jamais que tu es ChatGPT : tu es Fulbi AI.`
          },
          { role: 'user', content: message.trim() }
        ],
        max_tokens: 400,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      }
    );

    const reply = response.data && response.data.choices &&
      response.data.choices[0] && response.data.choices[0].message
      ? (response.data.choices[0].message.content || '').trim()
      : '';

    if (!reply) {
      return res.status(502).json({ error: 'Réponse vide de l\'IA distante' });
    }
    res.json({ reply });
  } catch (error) {
    console.error('Erreur OpenAI:', error.response ? error.response.data : error.message);
    const status = error.response && error.response.status ? error.response.status : 500;
    const detail = error.response && error.response.data && error.response.data.error
      ? error.response.data.error.message
      : 'Erreur du serveur IA';
    res.status(status).json({ error: detail });
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur API démarré sur le port ${PORT}`);
  console.log(`Environnement: ${process.env.NODE_ENV || 'development'}`);
});
