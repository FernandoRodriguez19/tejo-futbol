// Optional power-ups: ice blocks and soap bars that pop up in either half of the pitch.
// They're won with the ball: when it hits one, the player who touched it last (kick,
// body or a bounce off the walls after that) throws it at the rival. Ice freezes them
// (very slow), soap makes them slippery. Players walking over an item do nothing.
// Times are in "play time" ms (only advances while the ball is in play), so pauses,
// goals and replays don't eat into them.
import * as Phaser from 'phaser';
import { GAME_W, FIELD, MID_Y, BALL_R, HAZARDS, PALETTE } from '../config.js';
import { SPRITE_SCALE } from '../art.js';
import { titleText } from '../ui.js';
import { floatText } from './juice.js';
import { sfx } from '../sound.js';

const MARGIN = 60; // keep items away from the walls and the halfway line

export default class Hazards {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.nextSpawn = 0;
    this.lastBall = null;
  }

  // Clears the pitch and schedules the next item (called at every kickoff).
  reset(playTime) {
    for (const item of this.items) item.parts.forEach((part) => part.destroy());
    this.items = [];
    this.lastBall = null;
    this.nextSpawn = playTime + Phaser.Math.Between(HAZARDS.spawnMin, HAZARDS.spawnMax);
  }

  update(playTime, ball, players) {
    if (playTime >= this.nextSpawn) {
      if (this.items.length < HAZARDS.maxOnField) this.spawn(playTime, [...players, ball]);
      this.nextSpawn = playTime + Phaser.Math.Between(HAZARDS.spawnMin, HAZARDS.spawnMax);
    }
    // The ball can move further than an item in one frame, so check the whole path
    // it travelled since the last frame.
    const from = this.lastBall ?? { x: ball.x, y: ball.y };
    this.lastBall = { x: ball.x, y: ball.y };

    for (const item of [...this.items]) {
      const left = item.until - playTime;
      if (left <= 0) {
        this.remove(item, false);
        continue;
      }
      // Blink during the last second and a half so players see it's about to go.
      item.sprite.setAlpha(left < 1500 ? 0.45 + 0.55 * Math.abs(Math.sin(playTime / 90)) : 1);

      // Nobody owns the ball right after a kickoff: it just rolls over the item.
      const owner = ball.lastTouch;
      if (owner && distToSegment(item, from, ball) < BALL_R + HAZARDS.radius * 0.8) {
        this.grab(item, owner, players.find((p) => p !== owner));
      }
    }
  }

  // `avoid`: players and the ball, so items don't pop up right on top of them.
  spawn(playTime, avoid) {
    const top = Math.random() < 0.5;
    const yMin = top ? FIELD.top + MARGIN : MID_Y + MARGIN;
    const yMax = top ? MID_Y - MARGIN : FIELD.bottom - MARGIN;
    // Try a few spots that aren't right on top of a player or another item.
    for (let tries = 0; tries < 20; tries++) {
      const x = Phaser.Math.Between(FIELD.left + MARGIN, FIELD.right - MARGIN);
      const y = Phaser.Math.Between(yMin, yMax);
      const crowded = [...avoid, ...this.items].some((o) => Math.hypot(o.x - x, o.y - y) < 110);
      if (crowded) continue;

      const s = this.scene;
      const type = Math.random() < 0.5 ? 'ice' : 'soap';
      // A bullseye on the grass under the item says "hit this", not "walk over this".
      const target = s.add.image(x, y, 'target').setDepth(3.4).setScale(0).setAlpha(0.7);
      s.tweens.add({ targets: target, scale: SPRITE_SCALE * 1.15, duration: 280, ease: 'Back.Out' });
      s.tweens.add({ targets: target, scale: SPRITE_SCALE * 1.03, delay: 280, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const sprite = s.add.image(x, y, type).setDepth(3.5).setScale(0);
      s.tweens.add({ targets: sprite, scale: SPRITE_SCALE * 1.1, duration: 280, ease: 'Back.Out' });
      s.tweens.add({ targets: sprite, angle: { from: -6, to: 6 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const parts = [target, sprite];

      // Until the player has won one with the ball, each item explains itself.
      if (!knowsPowerUps()) {
        const hint = titleText(s, Phaser.Math.Clamp(x, 150, GAME_W - 150), y - 62, '¡PEGALE CON\nLA PELOTA!', 20, PALETTE.yellow)
          .setDepth(12).setLineSpacing(-6);
        s.tweens.add({ targets: hint, y: hint.y - 8, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        parts.push(hint);
      }

      this.items.push({ type, x, y, sprite, parts, until: playTime + HAZARDS.lifetime });
      sfx.spawn();
      return;
    }
  }

  remove(item, instant) {
    this.items = this.items.filter((i) => i !== item);
    for (const part of item.parts) {
      this.scene.tweens.killTweensOf(part);
      if (instant) part.destroy();
      else this.scene.tweens.add({ targets: part, scale: 0, alpha: 0, duration: 200, onComplete: () => part.destroy() });
    }
  }

  // The ball hit the item: it shatters (ice) or bursts (soap), then flies from there at
  // the rival of whoever touched the ball last, spinning across the pitch. The effect
  // lands when it arrives.
  grab(item, owner, rival) {
    this.remove(item, true);
    const s = this.scene;
    owner.squash = 0.6;
    this.shatter(item);

    // Now the player knows how it works: no more hints, in this match or the next ones.
    if (!knowsPowerUps()) {
      rememberPowerUps();
      for (const other of this.items) {
        const hint = other.parts[2];
        if (hint) {
          other.parts.pop();
          s.tweens.killTweensOf(hint);
          s.tweens.add({ targets: hint, alpha: 0, duration: 200, onComplete: () => hint.destroy() });
        }
      }
    }

    const shot = s.add.image(item.x, item.y, item.type).setDepth(6).setScale(SPRITE_SCALE * 1.1);
    const flight = { t: 0 };
    s.tweens.add({
      targets: flight, t: 1, duration: HAZARDS.throwTime, ease: 'Quad.In',
      // Homes in on wherever the rival is now, spinning on the way.
      onUpdate: () => {
        shot.x = item.x + (rival.x - item.x) * flight.t;
        shot.y = item.y + (rival.y - item.y) * flight.t;
        shot.angle = 720 * flight.t;
      },
      onComplete: () => {
        shot.destroy();
        if (s.state === 'playing') this.apply(item.type, rival);
      },
    });
  }

  // Game juice for a hit: the ice breaks into shards, the soap pops into bubbles.
  shatter(item) {
    const s = this.scene;
    const { x, y } = item;
    s.hitstop = Math.max(s.hitstop, 50);
    s.cameras.main.shake(90, 0.006);
    if (item.type === 'ice') {
      sfx.crack();
      floatText(s, x, y - 40, '¡CRASH!', PALETTE.cyan, 30);
      s.grass.emit(x, y, {
        count: 24, speed: [180, 440], life: [400, 750], size: [4, 10],
        colors: [0xd4f4ff, 0x7fd6ff, 0xffffff], shape: 'rect', drag: 3,
      });
    } else {
      sfx.splash();
      floatText(s, x, y - 40, '¡PLOP!', '#ff7ac0', 30);
      s.dust.emit(x, y, {
        count: 22, speed: [90, 280], life: [450, 850], size: [4, 10], grow: 0.6,
        colors: [0xffffff, 0xffc2e2, 0xd8f4ff], alpha: 0.85, drag: 2,
      });
    }
  }

  apply(type, p) {
    const s = this.scene;
    const now = s.playTime;
    p.squash = 1;
    if (type === 'ice') {
      p.frozenUntil = now + HAZARDS.freezeTime;
      p.slipUntil = 0; // ice beats soap
      p.dashLeft = 0;
      sfx.freeze();
      floatText(s, p.x, p.y - 50, '¡CONGELADO!', PALETTE.cyan, 28);
      s.grass.emit(p.x, p.y, {
        count: 14, speed: [100, 260], life: [350, 650], size: [3, 6],
        colors: [0xd4f4ff, 0x7fd6ff, 0xffffff], shape: 'rect', drag: 3,
      });
    } else {
      p.slipUntil = now + HAZARDS.soapTime;
      sfx.soap();
      floatText(s, p.x, p.y - 50, '¡A PATINAR!', '#ff7ac0', 28);
      s.dust.emit(p.x, p.y, {
        count: 16, speed: [40, 140], life: [500, 900], size: [4, 9], grow: 0.4,
        colors: [0xffffff, 0xffc2e2, 0xd8f4ff], alpha: 0.8, drag: 2,
      });
    }
  }

  destroy() {
    for (const item of this.items) item.parts.forEach((part) => part.destroy());
    this.items = [];
  }
}

// Whether this browser's player has already won a power-up with the ball (then the
// "¡PEGALE CON LA PELOTA!" hints stop showing).
const KNOWS_KEY = 'tejo-futbol-sabe-powerups';
let knows = null;

function knowsPowerUps() {
  if (knows === null) {
    try {
      knows = localStorage.getItem(KNOWS_KEY) === '1';
    } catch {
      knows = false;
    }
  }
  return knows;
}

function rememberPowerUps() {
  knows = true;
  try {
    localStorage.setItem(KNOWS_KEY, '1');
  } catch {
    // Private mode: the hints just come back next time.
  }
}

// Distance from point p to the segment a-b.
function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Phaser.Math.Clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
