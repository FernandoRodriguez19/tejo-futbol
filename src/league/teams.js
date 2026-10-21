// The 20 league teams with their real colours (home kit) and an alternative kit for
// colour clashes. No crests: only names and colours.
//
// Kit patterns (seen from above, on the round player):
//   solid   one colour
//   trim    one colour with a ring of the second colour (collar/sleeves)
//   stripes vertical "bastones"
//   band    horizontal band across the chest
//   sash    diagonal band (River)
//   halves  left/right halves (Newell's)
//   v       chest V (Vélez)
//
// strength (0..1) mixes titles, international cups, history and recent form. It sets how
// well the team's bot plays and how it fares in the simulated matches.

export const TEAMS = [
  { id: 'river', name: 'River Plate', short: 'RIVER', strength: 0.95,
    home: { pattern: 'sash', colors: ['#ffffff', '#e30613'] },
    away: { pattern: 'sash', colors: ['#1d1d1d', '#e30613'] } },
  { id: 'boca', name: 'Boca Juniors', short: 'BOCA', strength: 0.95,
    home: { pattern: 'band', colors: ['#0b3d91', '#f7c600'] },
    away: { pattern: 'band', colors: ['#f7c600', '#0b3d91'] } },
  { id: 'racing', name: 'Racing Club', short: 'RACING', strength: 0.85,
    home: { pattern: 'stripes', colors: ['#6cc4ee', '#ffffff'] },
    away: { pattern: 'trim', colors: ['#1b2a5c', '#6cc4ee'] } },
  { id: 'independiente', name: 'Independiente', short: 'INDEPENDIENTE', strength: 0.8,
    home: { pattern: 'trim', colors: ['#d6001c', '#ffffff'] },
    away: { pattern: 'trim', colors: ['#ffffff', '#d6001c'] } },
  { id: 'estudiantes', name: 'Estudiantes', short: 'ESTUDIANTES', strength: 0.8,
    home: { pattern: 'stripes', colors: ['#e30613', '#ffffff'] },
    away: { pattern: 'trim', colors: ['#1b2a5c', '#e30613'] } },
  { id: 'velez', name: 'Vélez Sarsfield', short: 'VÉLEZ', strength: 0.78,
    home: { pattern: 'v', colors: ['#ffffff', '#1446a0'] },
    away: { pattern: 'v', colors: ['#1446a0', '#ffffff'] } },
  { id: 'sanlorenzo', name: 'San Lorenzo', short: 'SAN LORENZO', strength: 0.72,
    home: { pattern: 'stripes', colors: ['#1a3a8a', '#d0021b'] },
    away: { pattern: 'trim', colors: ['#ffffff', '#1a3a8a'] } },
  { id: 'talleres', name: 'Talleres', short: 'TALLERES', strength: 0.7,
    home: { pattern: 'stripes', colors: ['#0b2a63', '#ffffff'] },
    away: { pattern: 'trim', colors: ['#ffffff', '#0b2a63'] } },
  { id: 'central', name: 'Rosario Central', short: 'CENTRAL', strength: 0.68,
    home: { pattern: 'stripes', colors: ['#0a3d8f', '#f9c80e'] },
    away: { pattern: 'trim', colors: ['#f9c80e', '#0a3d8f'] } },
  { id: 'argentinos', name: 'Argentinos Juniors', short: 'ARGENTINOS', strength: 0.62,
    home: { pattern: 'trim', colors: ['#e30613', '#ffffff'] },
    away: { pattern: 'trim', colors: ['#ffffff', '#e30613'] } },
  { id: 'newells', name: "Newell's Old Boys", short: "NEWELL'S", strength: 0.6,
    home: { pattern: 'halves', colors: ['#d6001c', '#111111'] },
    away: { pattern: 'trim', colors: ['#ffffff', '#d6001c'] } },
  { id: 'huracan', name: 'Huracán', short: 'HURACÁN', strength: 0.58,
    home: { pattern: 'trim', colors: ['#ffffff', '#e30613'] },
    away: { pattern: 'trim', colors: ['#e30613', '#ffffff'] } },
  { id: 'defensa', name: 'Defensa y Justicia', short: 'DEFENSA', strength: 0.52,
    home: { pattern: 'trim', colors: ['#f5d000', '#0a7a3b'] },
    away: { pattern: 'trim', colors: ['#0a7a3b', '#f5d000'] } },
  { id: 'gimnasia', name: 'Gimnasia LP', short: 'GIMNASIA', strength: 0.5,
    home: { pattern: 'band', colors: ['#ffffff', '#0a2a6b'] },
    away: { pattern: 'band', colors: ['#0a2a6b', '#ffffff'] } },
  { id: 'platense', name: 'Platense', short: 'PLATENSE', strength: 0.48,
    home: { pattern: 'band', colors: ['#ffffff', '#5c3a1e'] },
    away: { pattern: 'band', colors: ['#5c3a1e', '#ffffff'] } },
  { id: 'belgrano', name: 'Belgrano', short: 'BELGRANO', strength: 0.48,
    home: { pattern: 'trim', colors: ['#5bc2e7', '#0b2a63'] },
    away: { pattern: 'trim', colors: ['#0b2a63', '#5bc2e7'] } },
  { id: 'union', name: 'Unión', short: 'UNIÓN', strength: 0.42,
    home: { pattern: 'stripes', colors: ['#e30613', '#ffffff'] },
    away: { pattern: 'trim', colors: ['#1d1d1d', '#e30613'] } },
  { id: 'tigre', name: 'Tigre', short: 'TIGRE', strength: 0.4,
    home: { pattern: 'band', colors: ['#0b2a7a', '#e30613'] },
    away: { pattern: 'band', colors: ['#ffffff', '#0b2a7a'] } },
  { id: 'banfield', name: 'Banfield', short: 'BANFIELD', strength: 0.4,
    home: { pattern: 'stripes', colors: ['#0a7a3b', '#ffffff'] },
    away: { pattern: 'trim', colors: ['#ffffff', '#0a7a3b'] } },
  { id: 'tucuman', name: 'Atlético Tucumán', short: 'TUCUMÁN', strength: 0.38,
    home: { pattern: 'stripes', colors: ['#6cc4ee', '#ffffff'] },
    away: { pattern: 'trim', colors: ['#0b2a63', '#6cc4ee'] } },
];

export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

// How much of each colour shows for each pattern, to estimate the kit's overall colour.
const MAIN_SHARE = { solid: 1, trim: 0.8, stripes: 0.5, band: 0.65, sash: 0.75, halves: 0.5, v: 0.8 };

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function averageColor(kit) {
  const share = MAIN_SHARE[kit.pattern] ?? 1;
  const a = rgb(kit.colors[0]);
  const b = rgb(kit.colors[1] ?? kit.colors[0]);
  return a.map((v, i) => v * share + b[i] * (1 - share));
}

function kitDistance(k1, k2) {
  const a = averageColor(k1);
  const b = averageColor(k2);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// The home team always wears its home kit; the visitor switches to the alternative
// one when the two would look too alike.
export function pickKits(home, away) {
  const homeKit = home.home;
  const clash = kitDistance(homeKit, away.home) < 100;
  const useAlt = clash && kitDistance(homeKit, away.away) > kitDistance(homeKit, away.home);
  return { home: homeKit, away: useAlt ? away.away : away.home };
}

// The kit's dominant colour, used for the scoreboard.
export function mainColor(kit) {
  return kit.colors[0];
}
