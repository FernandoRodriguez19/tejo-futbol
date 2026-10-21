// Every gameplay number lives here so the game can be tuned in one place.

export const GAME_W = 820;
export const GAME_H = 1120;

// Playable area (inside the white lines). The stands and scoreboard sit around it.
export const FIELD = { left: 70, right: 750, top: 130, bottom: 1050 };
export const CORNER_R = 90; // rounded corners; the ball bounces off the curve
export const MID_Y = (FIELD.top + FIELD.bottom) / 2;
export const CENTER_X = (FIELD.left + FIELD.right) / 2;

export const GOAL_W = 200;
export const GOAL_DEPTH = 36;
export const MOUTH_L = CENTER_X - GOAL_W / 2;
export const MOUTH_R = CENTER_X + GOAL_W / 2;
export const POST_R = 7;

export const PLAYER_R = 28;
export const PLAYER_SPEED = 380; // px/s
export const KICKOFF_OFFSET = 150; // distance from the goal line where players restart

export const BALL_R = 13;
export const BALL = {
  baseSpeed: 340, // speed after every kickoff
  maxSpeed: 1550, // hard cap; sub-steps keep it from tunnelling even at this speed
  wallBoost: 1.04, // each wall/post bounce
  bodyDamp: 0.88, // touching a body without kicking cushions the ball
  kickBoost: 1.15, // a kick multiplies the current speed...
  kickMin: 700, // ...but always leaves at least this fast
  minVerticalRatio: 0.22, // stops the ball from bouncing side to side forever
};

export const KICK = {
  reach: 15, // extra gap between body and ball where a kick still connects
  cooldown: 280, // ms between kicks
  buffer: 140, // ms a key press stays "armed" waiting for the ball
};

// Dash: a short burst of speed (Shift / R1). The bar fills in `charge` ms of play; the
// dash covers about duration × speed = 200 px, under half of your own half.
export const DASH = {
  charge: 30000,
  duration: 180, // ms
  speed: 1100, // px/s
};

// Optional power-ups ("hielo y jabón"): every so often an ice block or a bar of soap
// appears in one of the two halves. Whoever grabs it throws it at the rival, who gets
// frozen (very slow) or slippery (moves with a lot of inertia) for a while.
export const HAZARDS = {
  spawnMin: 6000, // ms between spawns (random in this range)
  spawnMax: 12000,
  lifetime: 9000, // ms an item stays on the pitch
  maxOnField: 2,
  radius: 24,
  freezeTime: 5000, // ms frozen
  freezeSpeed: 0.3, // speed multiplier while frozen
  soapTime: 6000, // ms slippery
  soapGrip: 1.2, // how fast you can change direction on soap (lower = slipperier)
  throwTime: 350, // ms the item takes to fly to the rival
};

// Volumes (0..1, before the sound button's level). The hits are synthesized and quiet on
// their own, so they go through a boost; the recorded music and crowd stay lower so the
// hits can be heard over them.
export const AUDIO = {
  sfxBoost: 2.2, // every synthesized effect (kicks, bounces, post...)
  menuMusic: 0.4,
  matchMusic: 0.2,
  matchMusicDucked: 0.08, // while a chant is playing
  chant: 0.3,
  goalShout: 0.8,
  ooh: 0.6,
};

export const WIN_GOALS = 5;
export const GOAL_PAUSE = 1600; // ms celebrating before the kickoff
export const KICKOFF_DELAY = 700; // ms the ball waits in the centre

// Cartoon palette inspired by arcade football games: saturated colours, thick dark outlines.
export const PALETTE = {
  ink: '#1d1240', // outlines and shadows
  grassA: '#9be33b',
  grassB: '#88d12e',
  apron: '#5aa625',
  purple: '#7b3fe4',
  purpleDark: '#5a2bb0',
  pink: '#ff4fa3',
  yellow: '#ffd23f',
  cyan: '#4be0ff',
  white: '#ffffff',
  titleFill: '#e6f9ff',
  p1: '#2f8bff',
  p1Dark: '#1b5fd1',
  p2: '#ff4757',
  p2Dark: '#c92a3a',
};

// Same colours as numbers, for Phaser APIs that want 0xRRGGBB.
export const COLORS = Object.fromEntries(
  Object.entries(PALETTE).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
);

export const FONTS = {
  title: '"Bungee", "Arial Black", sans-serif',
  ui: '"Rubik", "Arial", sans-serif',
};

export const BOT_LEVELS = {
  easy: { label: 'Fácil', speed: 0.6, reaction: 200, predict: 'straight', kickChance: 0.5, error: 30 },
  medium: { label: 'Medio', speed: 0.8, reaction: 130, predict: 'straight', kickChance: 0.85, error: 18 },
  hard: { label: 'Difícil', speed: 1.0, reaction: 45, predict: 'bounces', kickChance: 1, error: 4 },
};
