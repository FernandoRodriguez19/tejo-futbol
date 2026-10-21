// League mode: fixture, results, standings, simulated matches and saving.
import { TEAMS, TEAM_BY_ID } from './teams.js';
import { BOT_LEVELS, BALL } from '../config.js';

const STORAGE_KEY = 'tejo-futbol-liga-v1';
export const MATCH_SECONDS = 90;

// ---------- creation and saving ----------

// difficulty: 'easy' | 'medium' | 'hard' (see botConfigFor). hazards: ice & soap on/off.
export function newLeague(userId, difficulty = 'medium', hazards = false) {
  const ids = shuffle(TEAMS.map((t) => t.id));
  return { userId, difficulty, hazards, round: 0, schedule: roundRobin(ids), results: [], prevPositions: null };
}

export function loadLeague() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const league = raw ? JSON.parse(raw) : null;
    return league && TEAM_BY_ID[league.userId] ? league : null;
  } catch {
    return null;
  }
}

export function saveLeague(league) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(league));
  } catch {
    // Private mode or storage full: the league still works until the tab is closed.
  }
}

export function clearLeague() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

// Circle method: every team plays every other team once, 10 matches per round.
// Each match is hosted by whichever team has played fewer home games so far, which
// leaves everyone with 9 or 10 home games.
function roundRobin(ids) {
  const n = ids.length;
  const list = [...ids];
  const rounds = [];
  const homeGames = Object.fromEntries(ids.map((id) => [id, 0]));
  for (let r = 0; r < n - 1; r++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      const aHosts = homeGames[a] < homeGames[b] || (homeGames[a] === homeGames[b] && Math.random() < 0.5);
      const [home, away] = aHosts ? [a, b] : [b, a];
      homeGames[home]++;
      matches.push([home, away]);
    }
    rounds.push(matches);
    list.splice(1, 0, list.pop()); // rotate everyone except the first team
  }
  return rounds;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- rounds ----------

export function totalRounds(league) {
  return league.schedule.length;
}

export function isFinished(league) {
  return league.round >= league.schedule.length;
}

// The user's match in the current round: { home, away, userIsHome }.
export function nextUserMatch(league) {
  if (isFinished(league)) return null;
  const [home, away] = league.schedule[league.round].find(([h, a]) => h === league.userId || a === league.userId);
  return { home, away, userIsHome: home === league.userId };
}

// Stores the user's score, simulates the rest of the round and moves to the next one.
export function recordUserMatch(league, userGoals, rivalGoals) {
  const prev = positionsById(league);
  const round = league.schedule[league.round].map(([home, away]) => {
    if (home === league.userId) return { home, away, hg: userGoals, ag: rivalGoals, user: true };
    if (away === league.userId) return { home, away, hg: rivalGoals, ag: userGoals, user: true };
    return { home, away, ...simulateMatch(TEAM_BY_ID[home], TEAM_BY_ID[away]) };
  });
  league.results.push(round);
  league.prevPositions = prev;
  league.round++;
  saveLeague(league);
  return round;
}

// Goals follow a Poisson distribution whose average depends on the strength gap,
// with a small home advantage. Draws happen naturally.
export function simulateMatch(home, away) {
  const diff = home.strength - away.strength;
  const hg = poisson(clamp(1.6 + 2.4 * diff + 0.2, 0.25, 4));
  const ag = poisson(clamp(1.6 - 2.4 * diff, 0.25, 4));
  return { hg, ag };
}

function poisson(lambda) {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = Math.random();
  while (p > limit) {
    k++;
    p *= Math.random();
  }
  return k;
}

// ---------- standings ----------

export function standings(league) {
  const rows = Object.fromEntries(TEAMS.map((t) => [t.id, {
    id: t.id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0,
  }]));

  for (const round of league.results) {
    for (const { home, away, hg, ag } of round) {
      const h = rows[home];
      const a = rows[away];
      h.pj++; a.pj++;
      h.gf += hg; h.gc += ag;
      a.gf += ag; a.gc += hg;
      if (hg > ag) { h.pg++; a.pp++; h.pts += 3; }
      else if (hg < ag) { a.pg++; h.pp++; a.pts += 3; }
      else { h.pe++; a.pe++; h.pts++; a.pts++; }
    }
  }

  const list = Object.values(rows);
  for (const r of list) r.dg = r.gf - r.gc;
  // Points, then goal difference, then goals scored, then name.
  list.sort((x, y) => y.pts - x.pts || y.dg - x.dg || y.gf - x.gf
    || TEAM_BY_ID[x.id].name.localeCompare(TEAM_BY_ID[y.id].name));
  list.forEach((r, i) => { r.pos = i + 1; });
  return list;
}

function positionsById(league) {
  return Object.fromEntries(standings(league).map((r) => [r.id, r.pos]));
}

// ---------- bots ----------

// How the league difficulty shifts every rival: on easy even the big teams play like a
// medium bot, on hard even the small ones do. Strong teams are always tougher than weak ones.
const DIFFICULTY_SHIFT = { easy: -0.35, medium: 0, hard: 0.35 };

// Weakest bot of a medium or hard league (the kid-friendly BOT_LEVELS.easy is only the
// floor of easy leagues, so small teams don't become pushovers on medium).
const LEAGUE_FLOOR = { speed: 0.6, reaction: 200, kickChance: 0.5, error: 30 };

// Turns a team's strength (and the league difficulty) into bot settings, blending the
// weakest and hard levels.
export function botConfigFor(strength, difficulty = 'medium') {
  const t = clamp((strength - 0.35) / 0.6 + (DIFFICULTY_SHIFT[difficulty] ?? 0), 0, 1);
  const { hard } = BOT_LEVELS;
  const low = difficulty === 'easy' ? BOT_LEVELS.easy : LEAGUE_FLOOR;
  return {
    speed: lerp(low.speed, hard.speed, t),
    reaction: lerp(low.reaction, hard.reaction, t),
    kickChance: lerp(low.kickChance, hard.kickChance, t),
    error: lerp(low.error, hard.error, t),
    predict: t > 0.6 ? 'bounces' : 'straight',
    dash: t > 0.6 ? 'smart' : t > 0.25 ? 'defense' : 'none',
    // Soft kicks and body only at the weak end of an easy league.
    kickPower: lerp(low.kickPower ?? 1, 1, t),
    bodyDamp: lerp(low.bodyDamp ?? BALL.bodyDamp, BALL.bodyDamp, t),
    aggression: lerp(low.aggression ?? 1, 1, t),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
