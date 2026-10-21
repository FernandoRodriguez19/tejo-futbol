// Visual "game juice" drawn on top of the match: cartoon eyes, the goal net rippling,
// the crowd jumping and comic-style floating words.
import {
  FIELD, GAME_W, GAME_H, MOUTH_L, MOUTH_R, GOAL_W, GOAL_DEPTH, COLORS, PALETTE,
} from '../config.js';
import { titleText } from '../ui.js';

const INK = COLORS.ink;

// ---------- floating words ("¡ZAPATAZO!", "¡PALO!"...) ----------

export function floatText(scene, x, y, text, color = PALETTE.yellow, size = 34) {
  const clampedX = Math.max(140, Math.min(GAME_W - 140, x));
  const t = titleText(scene, clampedX, y, text, size, color)
    .setDepth(12).setScale(0.2).setAngle((Math.random() - 0.5) * 16);
  scene.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.Out' });
  scene.tweens.add({
    targets: t, y: y - 60, alpha: 0, delay: 450, duration: 450, ease: 'Cubic.In',
    onComplete: () => t.destroy(),
  });
  return t;
}

// ---------- eyes ----------

// Two cartoon eyes on the side of the player facing the ball. mood: 'normal' | 'angry'
// (kick held) | 'happy' (just scored) | 'dizzy' (just conceded). Blinks every few seconds.
export function drawEyes(g, p, ball, now, mood) {
  let dx = ball.x - p.x;
  let dy = ball.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const px = -dy;
  const py = dx;

  if (!p.nextBlink) p.nextBlink = now + 1500 + Math.random() * 3000;
  if (now > p.nextBlink + 120) p.nextBlink = now + 2000 + Math.random() * 3500;
  const blinking = now > p.nextBlink && mood === 'normal';

  for (const side of [-1, 1]) {
    const ex = p.x + dx * 10 + px * side * 9;
    const ey = p.y + dy * 10 + py * side * 9;

    if (mood === 'dizzy') {
      g.lineStyle(3.5, INK, 1);
      g.lineBetween(ex - 4, ey - 4, ex + 4, ey + 4);
      g.lineBetween(ex - 4, ey + 4, ex + 4, ey - 4);
      continue;
    }
    if (mood === 'happy') {
      // "^" shaped closed eyes.
      g.lineStyle(3.5, INK, 1);
      g.beginPath();
      g.moveTo(ex - px * 5 + dx * 1, ey - py * 5 + dy * 1);
      g.lineTo(ex + dx * 4, ey + dy * 4);
      g.lineTo(ex + px * 5 + dx * 1, ey + py * 5 + dy * 1);
      g.strokePath();
      continue;
    }
    if (blinking) {
      g.lineStyle(3, INK, 1);
      g.lineBetween(ex - px * 6, ey - py * 6, ex + px * 6, ey + py * 6);
      continue;
    }

    g.fillStyle(0xffffff, 1);
    g.fillCircle(ex, ey, 6.5);
    g.lineStyle(2.5, INK, 1);
    g.strokeCircle(ex, ey, 6.5);
    g.fillStyle(INK, 1);
    g.fillCircle(ex + dx * 2.8, ey + dy * 2.8, 3.2);

    if (mood === 'angry') {
      // Brows slanting down toward the middle.
      const bx = ex + dx * 7.5;
      const by = ey + dy * 7.5;
      g.lineStyle(3.5, INK, 1);
      g.lineBetween(bx + px * side * 6 + dx * 2, by + py * side * 6 + dy * 2, bx - px * side * 3, by - py * side * 3);
    }
  }
}

// ---------- goal net ripple ----------

// The net bulges outward where the ball went in and wobbles for about a second.
export function drawNetRipple(g, net, now) {
  g.clear();
  if (!net) return false;
  const age = (now - net.t0) / 1000;
  if (age > 1.1) return false;

  const lineY = net.top ? FIELD.top : FIELD.bottom;
  const out = net.top ? -1 : 1; // direction away from the pitch
  const backY = lineY + out * GOAL_DEPTH;
  const amp = 22 * Math.exp(-age * 3.2) * Math.cos(age * 24);

  // Cover the static netting so only the moving one shows.
  const y0 = Math.min(lineY, backY);
  g.fillStyle(COLORS.apron, 1);
  g.fillRect(MOUTH_L + 4, y0 + (net.top ? 4 : 0), GOAL_W - 8, GOAL_DEPTH - 4);
  g.fillStyle(INK, 0.55);
  g.fillRect(MOUTH_L + 4, y0 + (net.top ? 4 : 0), GOAL_W - 8, GOAL_DEPTH - 4);

  const back = [];
  for (let x = MOUTH_L; x <= MOUTH_R + 0.1; x += 10) {
    const fall = Math.exp(-(((x - net.x) / 55) ** 2));
    back.push({ x, y: backY + out * amp * fall });
  }

  g.lineStyle(1.5, 0xffffff, 0.75);
  for (const pt of back) g.lineBetween(pt.x, lineY, pt.x, pt.y);
  for (const f of [0.33, 0.66]) {
    g.beginPath();
    back.forEach((pt, i) => {
      const y = lineY + (pt.y - lineY) * f;
      if (i === 0) g.moveTo(pt.x, y);
      else g.lineTo(pt.x, y);
    });
    g.strokePath();
  }
  g.lineStyle(3, 0xffffff, 0.9);
  g.beginPath();
  back.forEach((pt, i) => (i === 0 ? g.moveTo(pt.x, pt.y) : g.lineTo(pt.x, pt.y)));
  g.strokePath();
  return true;
}

// ---------- crowd celebration ----------

const CROWD_COLORS = [COLORS.pink, COLORS.yellow, COLORS.cyan, COLORS.purple, 0xff8a3d, 0xffffff, 0x3dd68c];
const SKIN = [0xf5c9a0, 0xd9a074, 0xa86b45, 0x7a4a2c];

// Fans in the side and bottom stands; drawn only while celebrating, over the static crowd.
export function makeFans() {
  const fans = [];
  let seed = 3;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const add = (x, y) => fans.push({
    x, y, color: CROWD_COLORS[Math.floor(rnd() * CROWD_COLORS.length)],
    skin: SKIN[Math.floor(rnd() * SKIN.length)], phase: rnd() * Math.PI * 2, speed: 14 + rnd() * 8,
  });
  for (let y = 104; y < GAME_H - 30; y += 13) {
    for (const x of [8, 21, 34]) add(x + rnd() * 3, y);
    for (const x of [786, 799, 812]) add(x + rnd() * 3, y);
  }
  for (let x = 6; x < GAME_W; x += 13) {
    for (const y of [1096, 1110]) add(x, y + rnd() * 3);
  }
  return fans;
}

export function drawCrowd(g, fans, celebration, now) {
  g.clear();
  if (!celebration) return false;
  const age = (now - celebration.t0) / 1000;
  if (age > 2.2) return false;
  const energy = Math.min(1, (2.2 - age) * 2);

  g.fillStyle(0x24124f, 1);
  g.fillRect(0, 96, 42, GAME_H - 96);
  g.fillRect(GAME_W - 42, 96, 42, GAME_H - 96);
  g.fillRect(0, GAME_H - 30, GAME_W, 30);

  const t = now / 1000;
  for (const f of fans) {
    const jump = Math.max(0, Math.sin(t * f.speed + f.phase)) * 7 * energy;
    const y = f.y - jump;
    g.fillStyle(f.color, 1);
    g.fillCircle(f.x, y + 6, 6.5);
    g.fillStyle(f.skin, 1);
    g.fillCircle(f.x, y, 4.2);
    if (jump > 3) {
      // Arms up.
      g.lineStyle(2, f.skin, 1);
      g.lineBetween(f.x - 5, y + 3, f.x - 8, y - 6);
      g.lineBetween(f.x + 5, y + 3, f.x + 8, y - 6);
    }
  }
  return true;
}

// ---------- shot detection ----------

// True if the ball, moving with (vx, vy), is heading into the goal defended by `side`
// within `horizon` seconds (ignoring bounces).
export function headingIntoGoal(ball, vx, vy, side, horizon = 0.6) {
  const goalY = side === 'bottom' ? FIELD.bottom : FIELD.top;
  const towards = side === 'bottom' ? vy > 0 : vy < 0;
  if (!towards) return false;
  const t = (goalY - ball.y) / vy;
  if (t < 0 || t > horizon) return false;
  const x = ball.x + vx * t;
  return x > MOUTH_L - 8 && x < MOUTH_R + 8;
}
