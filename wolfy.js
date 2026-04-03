import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  'Referer': 'https://wolfy.net/',
};

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function cached(key, data) { cache.set(key, { data, ts: Date.now() }); }
function fromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}

// ✅ Classement global — endpoint direct qui fonctionne
export async function getLeaderboard(limit = 10) {
  const cacheKey = `leaderboard_${limit}`;
  const hit = fromCache(cacheKey);
  if (hit) return hit;

  try {
    const res = await axios.get('https://wolfy.net/api/leaderboard', {
      headers: HEADERS,
      timeout: 10000,
    });

    const players = res.data;
    if (!Array.isArray(players)) return null;

    const result = players.slice(0, limit).map((u, i) => ({
      rank: u.rank || i + 1,
      pseudo: u.username,
      id: u.id,
      elo: u.elo,                          // lauriers
      xp: u.xp,
      rankPosition: u.ranking?.value,      // position dans le classement
      topPercent: u.ranking?.percent,      // top %
      skinVersion: u.skinVersion,
      isFriend: u.isFriend || false,
    }));

    cached(cacheKey, result);
    return result;
  } catch (e) {
    console.error('[Wolfy] Erreur leaderboard:', e.message);
    return null;
  }
}

// ✅ Stats d'un joueur — depuis le leaderboard global + page profil
export async function getPlayerStats(pseudo) {
  const cacheKey = `stats_${pseudo.toLowerCase()}`;
  const hit = fromCache(cacheKey);
  if (hit) return hit;

  // Étape 1 : cherche le joueur dans le leaderboard global
  try {
    const leaderboard = await getLeaderboard(9999);
    const player = leaderboard?.find(
      p => p.pseudo.toLowerCase() === pseudo.toLowerCase()
    );

    if (player) {
      // Étape 2 : récupère les stats détaillées depuis la page HTML
      const details = await getPlayerDetails(player.pseudo);
      const result = { ...player, ...details };
      cached(cacheKey, result);
      return result;
    }
  } catch (e) {
    console.error('[Wolfy] Erreur recherche joueur:', e.message);
  }

  return { error: 'not_found' };
}

// Récupère les stats détaillées depuis le HTML de la page profil
async function getPlayerDetails(pseudo) {
  try {
    const res = await axios.get(`https://wolfy.net/fr/leaderboard/${encodeURIComponent(pseudo)}`, {
      headers: { ...HEADERS, Accept: 'text/html' },
      timeout: 12000,
    });

    // Extrait le JSON embarqué dans la page Next.js
    const jsonMatch = res.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!jsonMatch?.[1]) return {};

    const json = JSON.parse(jsonMatch[1]);
    const pageProps = json.props?.pageProps;
    if (!pageProps) return {};

    const user = pageProps.user;
    const stats = pageProps.statistics;
    const history = pageProps.history || [];

    if (!user && !stats) return {};

    const individual = stats?.individual || {};
    const roles = stats?.roles || [];
    const lauriers = stats?.laurels || null;

    const favoriteRole = roles.length > 0
      ? `${roles[0].id} (${Math.round(roles[0].winRate * 100)}% WR)`
      : null;

    const lauriersTotal = lauriers
      ? (lauriers.basic || 0) + (lauriers.steel || 0) + (lauriers.bronze || 0) + (lauriers.silver || 0) + (lauriers.gold || 0)
      : null;

    const recentGames = history.slice(0, 5).map(h => ({
      role: h.role,
      won: h.winner,
      players: h.game?.playerCount,
      serious: h.game?.serious,
      kills: h.killCount,
      xp: h.xp,
    }));

    return {
      wins: individual.winCount || null,
      kills: individual.killCount || null,
      avgWordsPerGame: individual.wordAvg || null,
      isAlpha: (user?.monthsSubscribed || 0) > 0,
      monthsSubscribed: user?.monthsSubscribed || 0,
      lauriersTotal,
      lauriersDetail: lauriers,
      winrateInnocent: stats?.game?.innocent ? Math.round(stats.game.innocent.winRate * 100) : null,
      winrateMenace: stats?.game?.threat ? Math.round(stats.game.threat.winRate * 100) : null,
      favoriteRole,
      roleStats: roles,
      history: recentGames,
      createdAt: user?.createdAt || null,
    };
  } catch (e) {
    console.error('[Wolfy] Erreur détails joueur:', e.message);
    return {};
  }
}

// ✅ URL du skin d'un joueur
export function getSkinUrl(skinVersion) {
  if (!skinVersion) return null;
  return `https://wolfy.net/api/skin/render/user.png?version=${skinVersion}&profile=right&size=small`;
}
