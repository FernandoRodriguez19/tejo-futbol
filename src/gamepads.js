// Joystick / gamepad support (browser Gamepad API, "standard" button layout: Xbox,
// PlayStation and most USB pads). The first connected pad is player 1, the second
// player 2. The keyboard keeps working alongside.
//
// pollPads() must run once per frame (the active scene does it) so "just pressed"
// detection works.
import { GAME_W, PALETTE } from './config.js';
import { uiText } from './ui.js';

export const BTN = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
};
const KICK_BUTTONS = [BTN.A, BTN.X, BTN.RT]; // RB (R1) is the dash
const DEADZONE = 0.25;
const REPEAT_DELAY = 380; // ms before a held direction repeats in menus...
const REPEAT_EVERY = 140; // ...and then how often

let pads = [];
let prevButtons = {};
const known = new Set();
const menuDir = {}; // per pad: { dir, since, last }

function readPad(gp) {
  const buttons = gp.buttons.map((b) => b.pressed || b.value > 0.5);
  const prev = prevButtons[gp.index] ?? [];
  const down = (b) => !!buttons[b];
  const pressed = (b) => !!buttons[b] && !prev[b];

  // Movement: D-pad wins; otherwise the left stick, rescaled past the dead zone.
  let x = (down(BTN.RIGHT) ? 1 : 0) - (down(BTN.LEFT) ? 1 : 0);
  let y = (down(BTN.DOWN) ? 1 : 0) - (down(BTN.UP) ? 1 : 0);
  if (x || y) {
    const len = Math.hypot(x, y);
    x /= len;
    y /= len;
  } else {
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    const mag = Math.hypot(ax, ay);
    if (mag > DEADZONE) {
      const scaled = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE));
      x = (ax / mag) * scaled;
      y = (ay / mag) * scaled;
    }
  }

  return {
    index: gp.index,
    buttons,
    move: { x, y },
    down,
    pressed,
    kickHeld: KICK_BUTTONS.some(down),
    kickPressed: KICK_BUTTONS.some(pressed),
    dashPressed: pressed(BTN.RB),
  };
}

// Reads every connected pad. Returns the numbers (1, 2...) of pads that just connected.
export function pollPads() {
  const list = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter((gp) => gp && gp.connected) : [];
  list.sort((a, b) => a.index - b.index);
  pads = list.map(readPad);
  prevButtons = Object.fromEntries(pads.map((p) => [p.index, p.buttons]));

  const fresh = [];
  pads.forEach((p, slot) => {
    if (!known.has(p.index)) {
      known.add(p.index);
      fresh.push(slot + 1);
    }
  });
  for (const index of [...known]) if (!pads.some((p) => p.index === index)) known.delete(index);
  return fresh;
}

// The n-th connected pad (0 = player 1), or null.
export function pad(slot) {
  return pads[slot] ?? null;
}

export function padCount() {
  return pads.length;
}

// Turns pad input into the key codes the menu screens already understand.
function menuCodes() {
  const codes = [];
  const now = performance.now();
  for (const p of pads) {
    const { x, y } = p.move;
    let dir = null;
    if (Math.abs(y) > 0.5 && Math.abs(y) >= Math.abs(x)) dir = y < 0 ? 'ArrowUp' : 'ArrowDown';
    else if (Math.abs(x) > 0.5) dir = x < 0 ? 'ArrowLeft' : 'ArrowRight';

    const state = menuDir[p.index] ?? (menuDir[p.index] = { dir: null, since: 0, last: 0 });
    if (dir !== state.dir) {
      state.dir = dir;
      state.since = now;
      state.last = now;
      if (dir) codes.push(dir);
    } else if (dir && now - state.since > REPEAT_DELAY && now - state.last > REPEAT_EVERY) {
      state.last = now;
      codes.push(dir);
    }

    if (p.pressed(BTN.A) || p.pressed(BTN.START)) codes.push('Enter');
    if (p.pressed(BTN.B)) codes.push('Escape');
    if (p.pressed(BTN.Y)) codes.push('Tab');
    if (p.pressed(BTN.SELECT)) codes.push('KeyN');
  }
  return codes;
}

// The same controller often shows up twice (e.g. Steam adds a virtual copy of it), so a
// menu action that comes again this soon, from any pad, is taken as that copy and skipped.
const MENU_DEBOUNCE = 120; // ms (shorter than REPEAT_EVERY, so holding still repeats)
const lastMenuCode = {};

// Lets a menu scene be driven by joystick: each frame, pad input is fed to the scene's
// keydown handler as fake key events.
export function padMenu(scene, onKey) {
  const tick = () => {
    const fresh = pollPads();
    fresh.forEach((n) => padToast(scene, n));
    const now = performance.now();
    for (const code of new Set(menuCodes())) {
      if (now - (lastMenuCode[code] ?? -Infinity) < MENU_DEBOUNCE) continue;
      lastMenuCode[code] = now;
      onKey({ code, preventDefault() {} });
    }
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => scene.events.off('update', tick));
}

// "JOYSTICK 1 CONECTADO" notice at the top of the screen.
export function padToast(scene, n) {
  const make = () => uiText(scene, GAME_W / 2, 185, `🎮 JOYSTICK ${n} CONECTADO`, 24, PALETTE.yellow)
    .setDepth(50).setAlpha(0);
  const t = scene.asUI ? scene.asUI(make) : make();
  scene.tweens.add({ targets: t, alpha: 1, y: 165, duration: 200 });
  scene.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 400, onComplete: () => t.destroy() });
}
