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

// Big FIFA-style card background (dark purple with a diagonal light band), used by the
// team and nation pickers. rect: { x, y, w, h } (top-left corner and size).
export function sportsCard(scene, { x, y, w, h }) {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.ink, 1);
  g.fillRoundedRect(x, y + 10, w, h, 30);
  g.fillStyle(COLORS.purpleDark, 1);
  g.fillRoundedRect(x, y, w, h, 30);
  g.fillStyle(COLORS.purple, 1);
  g.fillPoints([
    { x: x + w * 0.38, y }, { x: x + w * 0.78, y },
    { x: x + w * 0.52, y: y + h }, { x: x + w * 0.12, y: y + h },
  ], true);
  g.fillStyle(0xffffff, 0.12);
  g.fillRoundedRect(x + 14, y + 12, w - 28, 50, 20);
  g.lineStyle(6, COLORS.ink, 1);
  g.strokeRoundedRect(x, y, w, h, 30);
  return g;
}

// Round yellow "NIVEL" badge for the pickers. Returns { container, setLevel(n) }; the
// number pops in every time it changes.
export function levelBadge(scene, x, y) {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.ink, 1);
  g.fillCircle(3, 5, 52);
  g.fillStyle(COLORS.yellow, 1);
  g.fillCircle(0, 0, 52);
  g.lineStyle(5, COLORS.ink, 1);
  g.strokeCircle(0, 0, 52);
  const text = scene.add.text(0, -6, '', { fontFamily: FONTS.title, fontSize: '40px', color: PALETTE.ink }).setOrigin(0.5);
  const label = scene.add.text(0, 30, 'NIVEL', { fontFamily: FONTS.ui, fontStyle: '900', fontSize: '14px', color: PALETTE.ink }).setOrigin(0.5);
  const container = scene.add.container(x, y, [g, text, label]).setAngle(-8);
  const setLevel = (n) => {
    text.setText(String(n));
    scene.tweens.killTweensOf(container);
    container.setScale(0.6);
    scene.tweens.add({ targets: container, scale: 1, duration: 300, ease: 'Back.Out' });
  };
  return { container, setLevel };
}

// Strength (0..1) as the 55-97 "level" number and 1-5 stars the pickers show.
export function levelOf(strength) {
  return Math.round(55 + strength * 42);
}

export function starsOf(strength) {
  const stars = Math.max(1, Math.round(strength * 5));
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
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

// Round button with a little gamepad, the twin of the sound button. Opens the controls
// panel (the scene also opens it with the C key).
export function controlsButton(scene, x, y, onClick, scale = 1) {
  const r = 30;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.ink, 1);
  g.fillCircle(0, 5, r);
  g.fillStyle(COLORS.purple, 1);
  g.fillCircle(0, 0, r);
  g.fillStyle(0xffffff, 0.22);
  g.fillEllipse(0, -r * 0.45, r * 1.3, r * 0.6);
  g.lineStyle(4, COLORS.ink, 1);
  g.strokeCircle(0, 0, r);

  // Gamepad: body with two grips, a cross on the left and two buttons on the right.
  g.fillStyle(0xffffff, 1);
  g.lineStyle(3, COLORS.ink, 1);
  g.fillRoundedRect(-18, -9, 36, 18, 8);
  g.strokeRoundedRect(-18, -9, 36, 18, 8);
  for (const side of [-1, 1]) {
    g.fillCircle(side * 12, 7, 7);
    g.strokeCircle(side * 12, 7, 7);
  }
  g.fillRect(-14, -8, 28, 14); // hides the grip outlines inside the body
  g.fillStyle(COLORS.ink, 1);
  g.fillRect(-13, -2, 10, 3);
  g.fillRect(-9.5, -5.5, 3, 10);
  g.fillStyle(COLORS.p2, 1);
  g.fillCircle(8, -2, 2.6);
  g.fillStyle(COLORS.p1, 1);
  g.fillCircle(13, 2, 2.6);

  const container = scene.add.container(x, y, [g]).setScale(scale);
  const zone = scene.add.zone(0, 0, r * 2 + 10, r * 2 + 10).setInteractive({ useHandCursor: true });
  container.add(zone);
  zone.on('pointerdown', (pointer, lx, ly, event) => {
    event.stopPropagation();
    onClick();
  });
  zone.on('pointerover', () => container.setScale(scale * 1.1));
  zone.on('pointerout', () => container.setScale(scale));
  return container;
}

// A keyboard key drawn as a little white keycap. Returns the parts to add to a container.
function keycap(scene, x, y, label, w = 48) {
  const h = 46;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.ink, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2 + 5, w, h, 10);
  g.fillStyle(0xd9d3f5, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 3, w - 8, h - 12, 8);
  g.lineStyle(3, COLORS.ink, 1);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);
  const text = scene.add.text(x, y - 3, label, {
    fontFamily: FONTS.title, fontSize: label.length > 2 ? '14px' : '20px', color: PALETTE.ink,
  }).setOrigin(0.5);
  return [g, text];
}

// Four keys in the usual "inverted T": up on top, left / down / right below.
function keyCluster(scene, x, y, [up, left, down, right]) {
  return [
    ...keycap(scene, x, y - 27, up),
    ...keycap(scene, x - 52, y + 27, left),
    ...keycap(scene, x, y + 27, down),
    ...keycap(scene, x + 52, y + 27, right),
  ];
}

// Round or pill-shaped gamepad button.
function padButton(scene, x, y, label, color, w = 46) {
  const h = 46;
  const g = scene.add.graphics();
  g.fillStyle(COLORS.ink, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2 + 5, w, h, h / 2);
  g.fillStyle(color, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
  g.lineStyle(3, COLORS.ink, 1);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
  const text = scene.add.text(x, y, label, {
    fontFamily: FONTS.title, fontSize: label.length > 2 ? '14px' : '20px', color: PALETTE.white,
    stroke: PALETTE.ink, strokeThickness: 4,
  }).setOrigin(0.5);
  return [g, text];
}

// "CONTROLES" panel drawn over the current screen: keys for both players and the
// joystick, drawn as keycaps and buttons. Nothing in it is animated, so it also works on
// the pause screen (where tweens are stopped). The scene passes its key presses to
// panel.key(code); Esc, Enter, Space or C close it, and so do a click outside and the
// "¡LISTO!" button. Returns { container, key(code), close() }.
export function controlsPanel(scene, onClose) {
  const cx = GAME_W / 2;
  const left = 60;
  const width = GAME_W - 120;
  const top = 150;
  const height = 840;
  const parts = [];

  const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.8).setOrigin(0).setInteractive();
  const g = scene.add.graphics();
  g.fillStyle(COLORS.ink, 1);
  g.fillRoundedRect(left - 6, top + 6, width + 12, height, 28);
  g.fillStyle(COLORS.purpleDark, 1);
  g.fillRoundedRect(left, top, width, height, 26);
  g.lineStyle(5, COLORS.ink, 1);
  g.strokeRoundedRect(left, top, width, height, 26);
  // Clicks on the panel itself land here instead of on the dim layer, which closes it.
  const body = scene.add.zone(cx, top + height / 2, width, height).setInteractive();
  parts.push(dim, g, body, titleText(scene, cx, top + 62, 'CONTROLES', 50));

  // One section per way of playing: a coloured header and three or four controls, each
  // with a yellow caption under it.
  const caption = (x, y, text) => uiText(scene, x, y, text, 15, PALETTE.yellow);
  const header = (y, text, color) => {
    const bar = scene.add.graphics();
    bar.fillStyle(color, 1);
    bar.fillRoundedRect(left + 24, y - 18, width - 48, 36, 12);
    bar.lineStyle(3, COLORS.ink, 1);
    bar.strokeRoundedRect(left + 24, y - 18, width - 48, 36, 12);
    return [bar, uiText(scene, cx, y, text, 18)];
  };
  const col = [cx - 200, cx + 10, cx + 200];

  let y = top + 140;
  parts.push(...header(y, 'JUGADOR 1  ·  AZUL  ·  ABAJO', COLORS.p1));
  parts.push(...keyCluster(scene, col[0], y + 86, ['W', 'A', 'S', 'D']), caption(col[0], y + 152, 'MOVERSE'));
  parts.push(...keycap(scene, col[1], y + 113, 'ESPACIO', 150), caption(col[1], y + 152, 'PATEAR'));
  parts.push(...keycap(scene, col[2], y + 113, 'SHIFT IZQ', 120), caption(col[2], y + 152, 'DASH'));

  y += 210;
  parts.push(...header(y, 'JUGADOR 2  ·  ROJO  ·  ARRIBA', COLORS.p2));
  parts.push(...keyCluster(scene, col[0], y + 86, ['↑', '←', '↓', '→']), caption(col[0], y + 152, 'MOVERSE'));
  parts.push(...keycap(scene, col[1], y + 113, 'ENTER', 120), caption(col[1], y + 152, 'PATEAR'));
  parts.push(...keycap(scene, col[2], y + 113, 'SHIFT DER', 120), caption(col[2], y + 152, 'DASH'));

  y += 210;
  parts.push(...header(y, 'JOYSTICK', COLORS.purple));
  const pad = [cx - 225, cx - 75, cx + 75, cx + 225];
  const stick = scene.add.graphics();
  stick.fillStyle(COLORS.ink, 1);
  stick.fillCircle(pad[0], y + 82, 28);
  stick.fillStyle(0x55507a, 1);
  stick.fillCircle(pad[0], y + 78, 24);
  stick.fillStyle(0xffffff, 1);
  stick.fillCircle(pad[0], y + 74, 14);
  stick.lineStyle(3, COLORS.ink, 1);
  stick.strokeCircle(pad[0], y + 74, 14);
  parts.push(stick, caption(pad[0], y + 128, 'STICK O CRUZ: MOVERSE'));
  parts.push(...padButton(scene, pad[1], y + 78, 'A', 0x3dd68c), caption(pad[1], y + 128, 'PATEAR'));
  parts.push(...padButton(scene, pad[2], y + 78, 'R1', COLORS.p1, 64), caption(pad[2], y + 128, 'DASH'));
  parts.push(...padButton(scene, pad[3], y + 78, 'START', COLORS.pink, 88), caption(pad[3], y + 128, 'PAUSA'));

  parts.push(uiText(scene, cx, top + height - 118, 'Esc / Start: pausa  ·  M: sonido  ·  C: controles', 16, '#bfb3ff'));
  const ok = button(scene, cx, top + height - 60, 240, 62, '¡LISTO!', () => close(), 26);
  ok.setActive(true);
  parts.push(ok.container, ok.zone);

  const container = scene.add.container(0, 0, parts).setDepth(900);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    sfx.select();
    container.destroy();
    onClose?.();
  };
  dim.on('pointerdown', close);
  const key = (code) => {
    if (['Escape', 'Enter', 'Space', 'KeyC', 'Tab'].includes(code)) close();
  };
  sfx.select();
  return { container, key, close };
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
