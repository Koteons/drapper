import axios from 'axios';

// ─── Headers qui imitent un navigateur ────────────────────────────────────────
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  'Origin': 'https://wolfy.net/fr',
  'Referer': 'https://wolfy.net/fr/',
};

const BASE = 'https://api.wolfy.net';
const BASE_OLD = 'https://wolfy.net/fr';

// Cache simple pour éviter de spammer l'API (TTL: 5 min)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function cached(key, data) {
  cache.set(key, { data, ts: Date.now() });
}
function fromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

// ─── Recherche d'un joueur par pseudo ─────────────────────────────────────────
export async function searchPlayer(pseudo) {
  const cacheKey = `search_${pseudo.toLowerCase()}`;
  const hit = fromCache(cacheKey);
  if (hit) return hit;

  // Tentative 1 : API REST interne de Wolfy
  const endpoints = [
    `${BASE}/user/search?username=${encodeURIComponent(pseudo)}`,
    `${BASE}/users/search?q=${encodeURIComponent(pseudo)}`,
    `${BASE_OLD}/api/user/search?username=${encodeURIComponent(pseudo)}`,
    `${BASE_OLD}/api/users?search=${encodeURIComponent(pseudo)}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
      if (res.data) {
        const result = normalizeSearchResult(res.data, pseudo);
        if (result) { cached(cacheKey, result); return result; }
      }
    } catch {}
  }

  // Tentative 2 : Page profil publique en HTML
  try {
    const res = await axios.get(`${BASE_OLD}/leaderboard/${encodeURIComponent(pseudo)}`, {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 10000,
    });
    const result = parseProfileHTML(res.data, pseudo);
    if (result) { cached(cacheKey, result); return result; }
  } catch {}

  return null;
}

// ─── Récupération des stats complètes d'un joueur ─────────────────────────────
export async function getPlayerStats(pseudo) {
  const cacheKey = `stats_${pseudo.toLowerCase()}`;
  const hit = fromCache(cacheKey);
  if (hit) return hit;

  // Tentative via les endpoints API connus de Wolfy
  const endpoints = [
    `${BASE}/user/${encodeURIComponent(pseudo)}/stats`,
    `${BASE}/users/${encodeURIComponent(pseudo)}`,
    `${BASE}/player/${encodeURIComponent(pseudo)}`,
    `${BASE_OLD}/api/user/${encodeURIComponent(pseudo)}`,
    `${BASE_OLD}/api/stats/${encodeURIComponent(pseudo)}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
      if (res.data && (res.data.username || res.data.pseudo || res.data.name)) {
        const result = normalizeStats(res.data);
        if (result) { cached(cacheKey, result); return result; }
      }
    } catch {}
  }

  // Fallback : scraping HTML du profil public
  try {
    const res = await axios.get(`${BASE_OLD}/leaderboard/${encodeURIComponent(pseudo)}`, {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 12000,
    });
    const result = parseProfileHTML(res.data, pseudo);
    if (result) { cached(cacheKey, result); return result; }
  } catch (e) {
    if (e.response?.status === 404) return { error: 'not_found' };
  }

  return null;
}

// ─── Classement ───────────────────────────────────────────────────────────────
export async function getLeaderboard(limit = 10) {
  const cacheKey = `leaderboard_${limit}`;
  const hit = fromCache(cacheKey);
  if (hit) return hit;

  const endpoints = [
    `${BASE}/leaderboard?limit=${limit}`,
    `${BASE}/ranking?limit=${limit}`,
    `${BASE_OLD}/api/leaderboard`,
    `${BASE_OLD}/api/classement`,
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: 8000 });
      if (Array.isArray(res.data) || res.data?.players || res.data?.users || res.data?.ranking) {
        const result = normalizeLeaderboard(res.data, limit);
        if (result?.length > 0) { cached(cacheKey, result); return result; }
      }
    } catch {}
  }

  return null;
}

// ─── Normalisation des données JSON ───────────────────────────────────────────

function normalizeSearchResult(data, pseudo) {
  // Différents formats possibles selon l'endpoint
  const user = Array.isArray(data) ? data[0] : (data.user || data.data || data);
  if (!user) return null;

  return {
    pseudo: user.username || user.pseudo || user.name || pseudo,
    id: user.id || user._id || user.userId,
    avatar: user.avatar || user.skin || user.picture || null,
    level: user.level || user.lvl || null,
    grade: user.grade || user.rank || null,
  };
}

function normalizeStats(data) {
  const u = data.user || data.data || data;

  // Calcul winrate
  const wins = u.wins || u.gamesWon || u.victories || u.nbVictories || 0;
  const total = u.totalGames || u.gamesPlayed || u.nbGames || u.totalParties || 0;
  const losses = total - wins;
  const wr = total > 0 ? Math.round((wins / total) * 100) : 0;

  // Lauriers
  const lauriers = u.laurels || u.lauriers || u.points || u.score || null;
  const lauriersSaison = u.seasonLaurels || u.lauriersSaison || u.currentSeasonPoints || null;

  // Stats de rôle
  const roleStats = u.roleStats || u.roles || u.statsPerRole || null;

  // Historique
  const history = u.history || u.recentGames || u.lastGames || [];

  return {
    pseudo: u.username || u.pseudo || u.name,
    id: u.id || u._id,
    avatar: u.avatar || u.skin || u.picture || null,
    level: u.level || u.lvl || null,
    xp: u.xp || u.experience || null,
    grade: u.grade || u.gradeName || null,
    isAlpha: u.isAlpha || u.alpha || u.premium || false,

    // Stats globales
    wins,
    losses,
    total,
    winrate: wr,
    kills: u.kills || u.murders || u.nbKills || u.nbMurders || 0,
    avgWordsPerGame: u.avgWords || u.wordsPerGame || u.moyenneMots || null,

    // Lauriers
    lauriers,
    lauriersSaison,
    rankPosition: u.rankPosition || u.position || u.classement || null,

    // Innocent / Menace (camps)
    winrateInnocent: u.winrateInnocent || u.innocentWinrate || u.villagerWinrate || null,
    winrateMenace: u.winrateMenace || u.loupWinrate || u.wolfWinrate || null,

    // Rôle favori
    favoriteRole: u.favoriteRole || u.bestRole || u.topRole || null,

    roleStats,
    history: history.slice(0, 5),

    createdAt: u.createdAt || u.registeredAt || u.inscription || null,
  };
}

function normalizeLeaderboard(data, limit) {
  const arr = Array.isArray(data) ? data : (data.players || data.users || data.ranking || data.data || []);
  return arr.slice(0, limit).map((u, i) => ({
    rank: u.rank || u.position || i + 1,
    pseudo: u.username || u.pseudo || u.name,
    lauriers: u.laurels || u.lauriers || u.points || 0,
    wins: u.wins || u.gamesWon || 0,
    level: u.level || null,
    isAlpha: u.isAlpha || u.alpha || false,
  }));
}

// ─── Parsing HTML (fallback) ───────────────────────────────────────────────────
function parseProfileHTML(html, pseudo) {
  // Extraction des données JSON embarquées dans la page (Next.js / Nuxt / etc.)
  const jsonMatches = [
    // Next.js __NEXT_DATA__
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
    // Nuxt __NUXT__
    /window\.__NUXT__\s*=\s*(\{[\s\S]*?\})(?:\s*;)/,
    // Variable globale générique
    /window\.__STATE__\s*=\s*(\{[\s\S]*?\})\s*;/,
    // Données JSON inline
    /data-user="({[^"]+})"/,
  ];

  for (const regex of jsonMatches) {
    const match = html.match(regex);
    if (match?.[1]) {
      try {
        const json = JSON.parse(match[1]);
        const user = extractUserFromPageData(json);
        if (user) return normalizeStats(user);
      } catch {}
    }
  }

  // Parsing direct des éléments HTML connus de Wolfy
  return parseWolfyHTMLElements(html, pseudo);
}

function extractUserFromPageData(json) {
  // Cherche récursivement un objet ressemblant à un profil joueur
  if (!json || typeof json !== 'object') return null;

  // Patterns reconnaissables
  if (json.username && (json.wins !== undefined || json.laurels !== undefined)) return json;
  if (json.user?.username) return json.user;
  if (json.props?.pageProps?.user) return json.props.pageProps.user;
  if (json.props?.pageProps?.player) return json.props.pageProps.player;
  if (json.data?.user) return json.data.user;

  // Cherche dans les clés de premier niveau
  for (const key of Object.keys(json)) {
    const val = json[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const found = extractUserFromPageData(val);
      if (found) return found;
    }
  }
  return null;
}

function parseWolfyHTMLElements(html, pseudo) {
  // Extraction regex directe sur le HTML — dernier recours
  const extract = (patterns) => {
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return m[1].trim();
    }
    return null;
  };

  const wins = extract([
    /parties?\s+gagn[eé]es?\s*:?\s*<[^>]+>(\d+)/i,
    /"wins"\s*:\s*(\d+)/,
    /"gamesWon"\s*:\s*(\d+)/,
    /"victories"\s*:\s*(\d+)/,
  ]);

  const total = extract([
    /parties?\s+jou[eé]es?\s*:?\s*<[^>]+>(\d+)/i,
    /"totalGames"\s*:\s*(\d+)/,
    /"gamesPlayed"\s*:\s*(\d+)/,
  ]);

  const lauriers = extract([
    /lauriers?\s*:?\s*<[^>]+>(\d+)/i,
    /"laurels"\s*:\s*(\d+)/,
    /"lauriers"\s*:\s*(\d+)/,
    /"points"\s*:\s*(\d+)/,
  ]);

  const level = extract([
    /niveau\s*:?\s*<[^>]+>(\d+)/i,
    /"level"\s*:\s*(\d+)/,
    /"lvl"\s*:\s*(\d+)/,
  ]);

  const kills = extract([
    /meurtres?\s*:?\s*<[^>]+>(\d+)/i,
    /"kills"\s*:\s*(\d+)/,
    /"murders"\s*:\s*(\d+)/,
  ]);

  if (!wins && !lauriers && !level) return null;

  const w = parseInt(wins) || 0;
  const t = parseInt(total) || 0;
  const l = t - w;

  return {
    pseudo,
    wins: w,
    losses: l > 0 ? l : 0,
    total: t,
    winrate: t > 0 ? Math.round((w / t) * 100) : 0,
    lauriers: lauriers ? parseInt(lauriers) : null,
    lauriersSaison: null,
    level: level ? parseInt(level) : null,
    kills: kills ? parseInt(kills) : 0,
    rankPosition: null,
    winrateInnocent: null,
    winrateMenace: null,
    favoriteRole: null,
    roleStats: null,
    history: [],
    isAlpha: html.includes('alpha') || html.includes('Alpha'),
    createdAt: null,
    _source: 'html',
  };
}
