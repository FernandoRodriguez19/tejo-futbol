// Cup mode with national teams: optional group stage (groups of 4, top 2 go through,
// plus the best thirds when there are 12 groups, like a 48-team World Cup) and a
// knockout bracket. Knockout matches can't end in a draw: the user's go to golden goal,
// simulated ones to penalties. Saved in localStorage like the league.
import { NATIONS, NATION_BY_ID } from './nations.js';
import { simulateMatch } from '../league/league.js';

const STORAGE_KEY = 'tejo-futbol-copa-v1';

// Tournament sizes the player can pick for each format (smallest = shortest cup).
export const CUP_SIZES = {
  groups: [48, 32, 16, 8], // groups of 4: 12, 8, 4 or 2 groups
  knockout: [32, 16, 8, 4],
};

const GROUP_NAMES = 'ABCDEFGHIJKL';

// ---------- creation and saving ----------

// The user's team plus the strongest others make up the field.
export function newCup(userId, { format = 'groups', size = 48, difficulty = 'medium', hazards = false } = {}) {
  const others = NATIONS.filter((n) => n.id !== userId).slice(0, size - 1).map((n) => n.id);
  const teams = [userId, ...others];
  const cup = {
    userId, format, size, difficulty, hazards, teams,
    stage: format === 'groups' ? 'groups' : 'knockout',
    groups: [], groupRound: 0, groupResults: [],
    rounds: [], eliminated: false, champion: null,
  };
  if (format === 'groups') cup.groups = drawGroups(teams);
  else cup.rounds = [pairSeeds(bySeed(teams))];
  return cup;
}

export function loadCup() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const cup = raw ? JSON.parse(raw) : null;
    return cup && NATION_BY_ID[cup.userId] ? cup : null;
  } catch {
    return null;
  }
}

export function saveCup(cup) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cup));
  } catch {
    // Private mode or storage full: the cup still works until the tab is closed.
  }
}

export function clearCup() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

// ---------- draw ----------

// World-Cup-style draw: four pots by strength, one team of each pot per group.
function drawGroups(teams) {
  const sorted = bySeed(teams);
  const count = teams.length / 4;
  const pots = [0, 1, 2, 3].map((p) => shuffle(sorted.slice(p * count, (p + 1) * count)));
  return Array.from({ length: count }, (_, g) => ({
    name: GROUP_NAMES[g],
    teams: pots.map((pot) => pot[g]),
  }));
}

// Each group plays three matchdays: everyone meets everyone once.
const GROUP_SCHEDULE = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];

function bySeed(ids) {
  return [...ids].sort((a, b) => NATION_BY_ID[b].strength - NATION_BY_ID[a].strength);
}

// Standard seeded bracket (1 vs N, 2 vs N-1...) laid out so the top seeds can only meet
// late. Returns the first round's matches.
function pairSeeds(seeded) {
  const order = bracketOrder(seeded.length);
  const matches = [];
  for (let i = 0; i < order.length; i += 2) {
    matches.push({ a: seeded[order[i]], b: seeded[order[i + 1]], ag: null, bg: null, winner: null, pens: false });
  }
  return matches;
}

// Seed positions for a bracket of n (power of two): [0, n-1, n/2-1, n/2, ...].
function bracketOrder(n) {
  let order = [0, 1];
  while (order.length < n) {
    const size = order.length * 2;
    order = order.flatMap((s) => [s, size - 1 - s]);
  }
  return order;
}

// ---------- queries ----------

export function isFinished(cup) {
  return cup.stage === 'done';
}

export function roundName(teamsLeft) {
  return { 2: 'FINAL', 4: 'SEMIFINAL', 8: 'CUARTOS DE FINAL', 16: 'OCTAVOS DE FINAL', 32: 'DIECISEISAVOS' }[teamsLeft]
    ?? `RONDA DE ${teamsLeft}`;
}

// Name of what's being played now, e.g. "FASE DE GRUPOS · FECHA 2" or "CUARTOS DE FINAL".
export function stageLabel(cup) {
  if (cup.stage === 'groups') return `FASE DE GRUPOS · FECHA ${cup.groupRound + 1} DE 3`;
  if (cup.stage === 'knockout') return roundName(currentRound(cup).length * 2);
  return 'TORNEO TERMINADO';
}

export function currentRound(cup) {
  return cup.rounds[cup.rounds.length - 1];
}

export function userGroup(cup) {
  return cup.groups.find((g) => g.teams.includes(cup.userId)) ?? null;
}

export function groupStandings(cup, group) {
  const rows = Object.fromEntries(group.teams.map((id) => [id, {
    id, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0,
  }]));
  for (const md of cup.groupResults) {
    for (const r of md) {
      if (r.group !== group.name) continue;
      const h = rows[r.home];
      const a = rows[r.away];
      h.pj++; a.pj++;
      h.gf += r.hg; h.gc += r.ag; a.gf += r.ag; a.gc += r.hg;
      if (r.hg > r.ag) { h.pg++; a.pp++; h.pts += 3; } else if (r.hg < r.ag) { a.pg++; h.pp++; a.pts += 3; } else {
        h.pe++; a.pe++; h.pts++; a.pts++;
      }
    }
  }
  const list = Object.values(rows);
  for (const r of list) r.dg = r.gf - r.gc;
  list.sort(compareRows);
  list.forEach((r, i) => { r.pos = i + 1; });
  return list;
}

function compareRows(x, y) {
  return y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || NATION_BY_ID[y.id].strength - NATION_BY_ID[x.id].strength;
}

// The user's next match: { home, away, userIsHome, knockout }, or null.
export function nextUserMatch(cup) {
  if (cup.eliminated || cup.stage === 'done') return null;
  if (cup.stage === 'groups') {
    const g = userGroup(cup);
    const [i, j] = GROUP_SCHEDULE[cup.groupRound].find(([x, y]) => g.teams[x] === cup.userId || g.teams[y] === cup.userId);
    const home = g.teams[i];
    const away = g.teams[j];
    return { home, away, userIsHome: home === cup.userId, knockout: false };
  }
  const m = currentRound(cup).find((x) => x.a === cup.userId || x.b === cup.userId);
  return m ? { home: m.a, away: m.b, userIsHome: m.a === cup.userId, knockout: true } : null;
}

// ---------- playing ----------

// Stores the user's result, simulates everything else in that matchday / round and
// moves the cup forward.
export function recordUserMatch(cup, userGoals, rivalGoals) {
  const m = nextUserMatch(cup);
  if (!m) return;
  const hg = m.userIsHome ? userGoals : rivalGoals;
  const ag = m.userIsHome ? rivalGoals : userGoals;
  if (cup.stage === 'groups') playGroupRound(cup, { home: m.home, away: m.away, hg, ag });
  else playKnockoutRound(cup, { a: m.home, b: m.away, ag: hg, bg: ag });
  saveCup(cup);
}

// After the user is knocked out: plays every remaining match to crown a champion.
export function simulateToEnd(cup) {
  while (cup.stage === 'groups') playGroupRound(cup, null);
  while (cup.stage === 'knockout') playKnockoutRound(cup, null);
  saveCup(cup);
}

function playGroupRound(cup, userResult) {
  const md = [];
  for (const g of cup.groups) {
    for (const [i, j] of GROUP_SCHEDULE[cup.groupRound]) {
      const home = g.teams[i];
      const away = g.teams[j];
      if (userResult && userResult.home === home && userResult.away === away) {
        md.push({ ...userResult, group: g.name, user: true });
      } else {
        md.push({ home, away, ...simulateMatch(NATION_BY_ID[home], NATION_BY_ID[away]), group: g.name });
      }
    }
  }
  cup.groupResults.push(md);
  cup.groupRound++;
  if (cup.groupRound === 3) startKnockout(cup);
}

// Top two of each group go through; with 12 groups also the 8 best thirds (32 in all).
function startKnockout(cup) {
  const tables = cup.groups.map((g) => groupStandings(cup, g));
  const winners = tables.map((t) => t[0]).sort(compareRows);
  const runners = tables.map((t) => t[1]).sort(compareRows);
  let qualified = [...winners, ...runners];
  let target = 1;
  while (target < qualified.length) target *= 2;
  if (target > qualified.length) {
    const thirds = tables.map((t) => t[2]).sort(compareRows);
    qualified = [...qualified, ...thirds.slice(0, target - qualified.length)];
  }
  const ids = qualified.map((r) => r.id);
  cup.qualified = ids;
  cup.stage = 'knockout';
  cup.rounds = [pairSeeds(ids)];
  if (!ids.includes(cup.userId)) cup.eliminated = true;
}

function playKnockoutRound(cup, userResult) {
  const round = currentRound(cup);
  for (const m of round) {
    if (userResult && m.a === userResult.a && m.b === userResult.b) {
      Object.assign(m, { ag: userResult.ag, bg: userResult.bg, user: true });
      // Golden goal means the user's match always has a winner; a draw only happens if
      // they abandon, which counts as a loss.
      m.winner = m.ag > m.bg ? m.a : m.bg > m.ag ? m.b : (m.a === cup.userId ? m.b : m.a);
    } else {
      const { hg, ag } = simulateMatch(NATION_BY_ID[m.a], NATION_BY_ID[m.b]);
      m.ag = hg;
      m.bg = ag;
      if (hg !== ag) m.winner = hg > ag ? m.a : m.b;
      else {
        // Penalties: a coin flip leaning toward the stronger team.
        const pa = 0.5 + (NATION_BY_ID[m.a].strength - NATION_BY_ID[m.b].strength) * 0.6;
        m.winner = Math.random() < pa ? m.a : m.b;
        m.pens = true;
      }
    }
  }
  const userIn = round.some((m) => m.a === cup.userId || m.b === cup.userId);
  if (userIn && !round.some((m) => m.winner === cup.userId)) cup.eliminated = true;

  if (round.length === 1) {
    cup.champion = round[0].winner;
    cup.stage = 'done';
    return;
  }
  const next = [];
  for (let i = 0; i < round.length; i += 2) {
    next.push({ a: round[i].winner, b: round[i + 1].winner, ag: null, bg: null, winner: null, pens: false });
  }
  cup.rounds.push(next);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
