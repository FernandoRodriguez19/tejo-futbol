// Shared cartoon UI pieces: chunky outlined text, buttons, the purple ribbon banner and
// the striped wipe used between screens.
import { COLORS, PALETTE, FONTS, GAME_W, GAME_H } from './config.js';
import { startLoop } from './music.js';
import { unlockAudio, sfx, getVolume, cycleVolume, onVolumeChange } from './sound.js';

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

// Round speaker button: each click (or the M key) cycles full → half → muted. The icon
// shows the sound waves left, or a red cross when muted.
export function soundButton(scene, x, y, scale = 1) {
  const r = 30;
  const g = scene.add.graphics();
  const container = scene.add.container(x, y, [g]).setScale(scale);

  const draw = () => {
    const level = getVolume();
    g.clear();
    g.fillStyle(COLORS.ink, 1);
    g.fillCircle(0, 5, r);
    g.fillStyle(level ? COLORS.purple : COLORS.purpleDark, 1);
    g.fillCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.22);
    g.fillEllipse(0, -r * 0.45, r * 1.3, r * 0.6);
    g.lineStyle(4, COLORS.ink, 1);
    g.strokeCircle(0, 0, r);

    // Speaker: box + cone.
    const speaker = [
      { x: -16, y: -6 }, { x: -8, y: -6 }, { x: 2, y: -15 },
      { x: 2, y: 15 }, { x: -8, y: 6 }, { x: -16, y: 6 },
    ];
    g.fillStyle(0xffffff, 1);
    g.fillPoints(speaker, true);
    g.lineStyle(3, COLORS.ink, 1);
    g.strokePoints(speaker, true);

    if (level === 0) {
      for (const [w, color] of [[8, COLORS.ink], [4, COLORS.p2]]) {
        g.lineStyle(w, color, 1);
        g.lineBetween(7, -7, 19, 7);
        g.lineBetween(7, 7, 19, -7);
      }
      return;
    }
    const waves = level >= 1 ? 2 : 1;
    for (let i = 0; i < waves; i++) {
      for (const [w, color] of [[7, COLORS.ink], [3, 0xffffff]]) {
        g.lineStyle(w, color, 1);
        g.beginPath();
        g.arc(2, 0, 9 + i * 8, -0.85, 0.85);
        g.strokePath();
      }
    }
  };

  const toggle = () => {
    unlockAudio();
    cycleVolume();
    sfx.select();
    scene.tweens.add({ targets: container, scale: { from: scale * 1.25, to: scale }, duration: 220, ease: 'Back.Out' });
  };

  const zone = scene.add.zone(0, 0, r * 2 + 10, r * 2 + 10).setInteractive({ useHandCursor: true });
  container.add(zone);
  // Stop the click from also counting as a click on whatever is behind the button.
  zone.on('pointerdown', (pointer, lx, ly, event) => {
    event.stopPropagation();
    toggle();
  });
  zone.on('pointerover', () => container.setScale(scale * 1.1));
  zone.on('pointerout', () => container.setScale(scale));
  scene.input.keyboard.on('keydown-M', toggle);

  const stop = onVolumeChange(draw);
  scene.events.once('shutdown', stop);
  draw();
  return container;
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
