# 🎮 Brawl Stats — Backend

API proxy sécurisé + historique de trophées pour l'app Brawl Stars.

---

## Architecture

```
src/
├── index.js                  ← Point d'entrée Express
├── db/
│   ├── pool.js               ← Connexion PostgreSQL
│   └── migrate.js            ← Création des tables
├── services/
│   ├── brawlService.js       ← Appels API Supercell (avec cache)
│   └── snapshotService.js    ← Historique trophées en BDD
├── routes/
│   ├── players.js            ← /api/players
│   └── misc.js               ← /api/brawlers, rankings, events, clubs
├── jobs/
│   └── snapshotJob.js        ← Cron toutes les 6h
└── middleware/
    └── errorHandler.js       ← Gestion erreurs centralisée
```

---

## Installation locale

### 1. Prérequis
- Node.js ≥ 18
- PostgreSQL (local ou cloud)

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer l'environnement
```bash
cp .env.example .env
# Édite .env avec ta clé API et l'URL PostgreSQL
```

### 4. Créer les tables
```bash
npm run db:migrate
```

### 5. Lancer en développement
```bash
npm run dev
```

---

## Endpoints

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Santé du serveur + DB |
| GET | `/api/players/:tag` | Profil complet d'un joueur |
| GET | `/api/players/:tag/history?days=90` | **Courbe historique trophées** |
| POST | `/api/players/:tag/track` | Commence à suivre un joueur |
| DELETE | `/api/players/:tag/track` | Arrête le suivi |
| GET | `/api/players/:tag/battlelog` | Historique de batailles |
| GET | `/api/players` | Liste des joueurs suivis |
| GET | `/api/brawlers` | Catalogue des brawlers |
| GET | `/api/rankings/global` | Classement mondial |
| GET | `/api/rankings/FR` | Classement par pays |
| GET | `/api/events` | Rotation événements |
| GET | `/api/clubs/:tag` | Infos d'un club |

---

## Déploiement

### Option A — Railway (recommandé, le plus simple)
1. Crée un compte sur [railway.app](https://railway.app)
2. New Project → Deploy from GitHub → sélectionne ce repo
3. Add Plugin → PostgreSQL (Railway crée la DB et injecte `DATABASE_URL` automatiquement)
4. Variables d'environnement → colle le contenu de ton `.env`
5. Deploy → l'URL publique apparaît dans le dashboard

### Option B — Render (gratuit avec limitations)
1. [render.com](https://render.com) → New Web Service → connecte ton repo
2. Build Command : `npm install`
3. Start Command : `node src/index.js`
4. New PostgreSQL → copie l'Internal Database URL dans `DATABASE_URL`
5. Environment Variables → ajoute les variables de ton `.env`
6. Deploy — attention : le service s'endort après 15 min d'inactivité sur le plan gratuit

### Option C — VPS (contrôle total)
```bash
# Sur le serveur
git clone <ton-repo> && cd brawl-backend
npm install
cp .env.example .env && nano .env

# PostgreSQL
sudo apt install postgresql
sudo -u postgres createdb brawlstats
npm run db:migrate

# PM2 pour garder le process actif
npm install -g pm2
pm2 start src/index.js --name brawl-backend
pm2 save && pm2 startup
```

---

## Adapter le front-end

Dans ton app React, remplace les appels au proxy `allorigins` par ton backend :

```js
// Avant (proxy public non sécurisé)
const PROXY = "https://api.allorigins.win/get?url=";

// Après (ton backend)
const API_BASE = "https://ton-backend.railway.app/api";

async function apiFetch(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Courbe de trophées réelle
async function getTrophyHistory(tag, days = 90) {
  return apiFetch(`/players/${tag}/history?days=${days}`);
}
```

---

## Schéma BDD

```sql
tracked_players     -- Joueurs suivis
  tag, name, added_at, last_seen

trophy_snapshots    -- Un snapshot toutes les 6h par joueur
  player_tag, trophies, highest_trophies, exp_level, snapshot_at

api_cache           -- Cache des réponses Brawl API
  cache_key, data (JSONB), cached_at, ttl_seconds
```
