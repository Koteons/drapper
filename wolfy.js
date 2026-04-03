import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  'Referer': 'https://wolfy.net/',
};

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
let buildHash = null;
let buildHashTs = 0;
const HASH_TTL = 30 * 60 * 1000; // 30 min

function cached(key, data) { cache.set(key, { data, ts: Date.now() }); }
function fromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

// Récupère le hash de build Next.js depuis la page principale
async function getBuildHash() {
  if (buildHash && Date.now() - buildHashTs < HASH_TTL) return buildHash;
  try {
    const res = await axios.get('https://wolfy.net/fr/leaderboard', {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 10000,
    });
    const match = res.data.match(/\/_next\/static\/([a-f0-9]+)\/_buildManifest/) ||
                  res.data.match(/"buildId"\s*:\s*"([^"]+)"/) ||
                  res.data.match(/\/_next\/data\/([^/]+)\//);
    if (match?.[1]) {
      buildHash = match[1];
      buildHashTs = Date.now();
      return buildHash;
    }
  } catch {}
  return null;
}

export async function getPlayerStats(pseudo) {
  const cacheKey = `stats_${pseudo.toLowerCase()}`;
  const hit = fromCache(cacheKey);
  if (hit) return hit;

  // Récupère le hash et appelle l'API Next.js
  const hash = await getBuildHash();
  console.log('[Wolfy] Hash:', hash);
  if (hash) {
    try {
      console.log('[Wolfy] Fetching URL:', `https://wolfy.net/_next/data/${hash}/fr/leaderboard/${encodeURIComponent(pseudo)}.json`);
      const url = `https://wolfy.net/_next/data/${hash}/fr/leaderboard/${encodeURIComponent(pseudo)}.json?id=${encodeURIComponent(pseudo)}`;
      const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
      if (res.data?.pageProps) {
        const result = parsePageProps(res.data.pageProps, pseudo);
        if (result) { cached(cacheKey, result); return result; }
      }
    } catch (e) {
      if (e.response?.status === 404) return { error: 'not_found' };
      // Hash peut être périmé, on le reset
      buildHash = null;
    }
  }

  // Fallback : scraping HTML
  try {
    const res = await axios.get(`https://wolfy.net/fr/leaderboard/${encodeURIComponent(pseudo)}`, {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 12000,
    });
    // Extrait le nouveau hash depuis la page
    const match = res.data.match(/\/_next\/data\/([^/]+)\//);
    if (match?.[1]) { buildHash = match[1]; buildHashTs = Date.now(); }

    // Cherche les données JSON embarquées
    const jsonMatch = res.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (jsonMatch?.[1]) {
      try {
        const json = JSON.parse(jsonMatch[1]);
        const result = parsePageProps(json.props?.pageProps, pseudo);
        if (result) { cached(cacheKey, result); return result; }
      } catch {}
    }
  } catch (e) {
    if (e.response?.status === 404) return { error: 'not_found' };
  }

  return null;
}

function parsePageProps(pageProps, pseudo) {
  if (!pageProps) return null;

  const user = pageProps.user;
  const stats = pageProps.statistics;
  const history = pageProps.history || [];

  if (!user && !stats) return null;

  // Stats individuelles
  const individual = stats?.individual || {};
  const wins = individual.winCount || 0;
  const kills = individual.killCount || 0;
  const wordAvg = individual.wordAvg || 0;

  // Lauriers
  const lauriers = stats?.laurels || stats?.lauriers || null;
  const lauriersTotaux = lauriers
    ? (lauriers.basic || 0) + (lauriers.steel || 0) + (lauriers.bronze || 0) + (lauriers.silver || 0) + (lauriers.gold || 0)
    : null;

  // Camps
  const innocent = stats?.game?.innocent;
  const threat = stats?.game?.threat;

  // Rôle favori (meilleur winrate avec le plus de parties)
  const roles = stats?.roles || [];
  const favoriteRole = roles.length > 0 ? roles[0] : null;

  // XP → niveau (approximatif)
  const xp = user?.xp || 0;
  const level = user?.rank || null;

  // Historique
  const recentGames = history.slice(0, 5).map(h => ({
    role: h.role,
    won: h.winner,
    players: h.game?.playerCount,
    serious: h.game?.serious,
    kills: h.killCount,
    xp: h.xp,
  }));

  return {
    pseudo: user?.username || pseudo,
    id: user?.id,
    avatar: user?.profilePicture || null,
    level,
    xp,
    isAlpha: (user?.monthsSubscribed || 0) > 0,
    monthsSubscribed: user?.monthsSubscribed || 0,

    wins,
    total: null, // pas dans les données
    losses: null,
    winrate: null,
    kills,
    avgWordsPerGame: wordAvg,

    lauriers: lauriersTotaux,
    lauriersDetail: lauriers,
    rankPosition: null,

    winrateInnocent: innocent ? Math.round(innocent.winRate * 100) : null,
    winrateMenace: threat ? Math.round(threat.winRate * 100) : null,

    favoriteRole: favoriteRole ? `${favoriteRole.id} (${Math.round(favoriteRole.winRate * 100)}% WR)` : null,
    roleStats: roles,
    history: recentGames,

    createdAt: user?.createdAt || null,
  };
}

export async function getLeaderboard(limit = 10) {
  const cacheKey = `leaderboard_${limit}`;
  const hit = fromCache(cacheKey);
  if (hit) return hit;

  const hash = await getBuildHash();
  console.log('[Wolfy] Hash:', hash);
  if (hash) {
    try {
      console.log('[Wolfy] Fetching URL:', `https://wolfy.net/_next/data/${hash}/fr/leaderboard/${encodeURIComponent(pseudo)}.json`);
      const url = `https://wolfy.net/_next/data/${hash}/fr/leaderboard.json`;
      const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
      const top = res.data?.pageProps?.top || [];
      if (top.length > 0) {
        const result = top.slice(0, limit).map((u, i) => ({
          rank: u.rank || i + 1,
          pseudo: u.username || u.pseudo || `Joueur #${i+1}`,
          lauriers: u.elo || u.laurels || 0,
          wins: u.wins || 0,
          level: u.rank || null,
          isAlpha: false,
        }));
        cached(cacheKey, result);
        return result;
      }
    } catch {}
  }

  return null;
}
