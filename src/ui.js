// Shared cartoon UI pieces: chunky outlined text, buttons, the purple ribbon banner and
// the striped wipe used between screens.
import { COLORS, PALETTE, FONTS, GAME_W, GAME_H } from './config.js';
import { startLoop } from './music.js';
import { unlockAudio } from './sound.js';

// Menu screens share one music loop that keeps going between them. Browsers only allow
// audio after a key press or click, so it's retried on the first one.
export function playMenuMusic(scene) {
  startLoop('menu');
  const retry = () => {
    unlockAudio();
    startLoop('menu');
  };
  scene.input.on('pointerdown', retry);
  scene.input.keyboard.on('keydown', retry);
}

// ---------- screen transitions ----------

const WIPE_SKEW = 260;
const WIPE_SPAN = GAME_W + WIPE_SKEW * 2;
const WIPE_COLORS = [COLORS.purple, COLORS.yellow, COLORS.ink, COLORS.pink, COLORS.purpleDark];

function makeWipe(scene) {
  const g = scene.add.graphics();
  const stripe = 90;
  for (let i = 0, x = -WIPE_SKEW; x < GAME_W + WIPE_SKEW; i++, x += stripe) {
    g.fillStyle(WIPE_COLORS[i % WIPE_COLORS.length], 1);
    g.fillPoints([
      { x, y: 0 }, { x: x + stripe + 1, y: 0 },
      { x: x + stripe + 1 - WIPE_SKEW, y: GAME_H }, { x: x - WIPE_SKEW, y: GAME_H },
    ], true);
  }
  // Extra cover on the trailing side so no gap shows while it slides.
  g.fillStyle(COLORS.purple, 1);
  g.fillRect(-WIPE_SPAN, 0, WIPE_SPAN - WIPE_SKEW, GAME_H);
  const c = scene.add.container(0, 0, [g]).setDepth(1000);
  return c;
}

// Slides the stripes in, then starts the next scene (which slides them out with wipeIn).
export function goTo(scene, key, data = {}) {
  if (scene.leaving) return;
  scene.leaving = true;
  const make = () => makeWipe(scene);
  const wipe = scene.asUI ? scene.asUI(make) : make();
  wipe.x = -WIPE_SPAN + WIPE_SKEW;
  scene.tweens.add({
    targets: wipe, x: WIPE_SKEW, duration: 300, ease: 'Cubic.In',
    onComplete: () => {
      scene.registry.set('wipeIn', true);
      scene.scene.start(key, data);
    },
  });
}

// Call at the start of every scene's create().
export function wipeIn(scene) {
  scene.leaving = false;
  if (!scene.registry.get('wipeIn')) return;
  scene.registry.set('wipeIn', false);
  const make = () => makeWipe(scene);
  const wipe = scene.asUI ? scene.asUI(make) : make();
  wipe.x = WIPE_SKEW;
  scene.tweens.add({
    targets: wipe, x: GAME_W + WIPE_SPAN, duration: 380, ease: 'Cubic.Out',
    onComplete: () => wipe.destroy(),
  });
}

export function titleText(scene, x, y, text, size, color = PALETTE.titleFill) {
  return scene.add.text(x, y, text, {
    fontFamily: FONTS.title,
    fontSize: `${size}px`,
    color,
    align: 'center',
    stroke: PALETTE.ink,
    strokeThickness: Math.max(6, Math.round(size / 7)),
    shadow: { offsetX: 0, offsetY: Math.round(size / 12), color: PALETTE.ink, fill: true, stroke: true },
  }).setOrigin(0.5);
}

export function uiText(scene, x, y, text, size, color = PALETTE.white) {
  return scene.add.text(x, y, text, {
    fontFamily: FONTS.ui,
    fontStyle: '900',
    fontSize: `${size}px`,
    color,
    align: 'center',
    stroke: PALETTE.ink,
    strokeThickness: Math.max(3, Math.round(size / 5)),
  }).setOrigin(0.5);
}

// Chunky rounded button (purple, yellow when active). Returns { container, setActive }.
export function button(scene, x, y, w, h, label, onClick, fontSize = 26) {
  const bg = scene.add.graphics();
  const text = scene.add.text(0, 0, label, { fontFamily: FONTS.title, fontSize: `${fontSize}px` }).setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, text]);
  const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', onClick);

  const setActive = (active) => {
    bg.clear();
    bg.fillStyle(COLORS.ink, 1);
    bg.fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 16);
    bg.fillStyle(active ? COLORS.yellow : COLORS.purple, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.fillStyle(0xffffff, 0.25);
    bg.fillRoundedRect(-w / 2 + 8, -h / 2 + 5, w - 16, h * 0.32, 9);
    bg.lineStyle(5, COLORS.ink, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    text.setColor(active ? PALETTE.ink : PALETTE.white);
    text.setStroke(PALETTE.ink, active ? 0 : 6);
  };
  setActive(false);
  return { container, zone, setActive };
}

// A purple ribbon with notched tails, like a sports title card. Returns a container
// centred on (x, y) holding the ribbon and its label.
export function ribbon(scene, x, y, label, width = 420, height = 58) {
  const g = scene.add.graphics();
  const hw = width / 2;
  const hh = height / 2;
  const tail = 36;
  const notch = 14;

  // Tails behind the ribbon, a bit lower and darker.
  for (const side of [-1, 1]) {
    const inner = side * (hw - 20);
    const outer = side * (hw + tail);
    const pts = [
      { x: inner, y: -hh + 12 }, { x: outer, y: -hh + 12 }, { x: outer - side * notch, y: 12 },
      { x: outer, y: hh + 12 }, { x: inner, y: hh + 12 },
    ];
    g.fillStyle(COLORS.purpleDark, 1);
    g.fillPoints(pts, true);
    g.lineStyle(5, COLORS.ink, 1);
    g.strokePoints(pts, true);
  }

  g.fillStyle(COLORS.purple, 1);
  g.fillRect(-hw, -hh, width, height);
  g.fillStyle(0xffffff, 0.18);
  g.fillRect(-hw, -hh, width, height * 0.35);
  g.lineStyle(5, COLORS.ink, 1);
  g.strokeRect(-hw, -hh, width, height);

  const text = scene.add.text(0, 0, label, {
    fontFamily: FONTS.title,
    fontSize: `${Math.round(height * 0.5)}px`,
    color: PALETTE.white,
    stroke: PALETTE.ink,
    strokeThickness: 6,
  }).setOrigin(0.5);

  return scene.add.container(x, y, [g, text]);
}
