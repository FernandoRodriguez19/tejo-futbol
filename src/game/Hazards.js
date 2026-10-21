// Optional power-ups: ice blocks and soap bars that pop up in either half of the pitch.
// Whoever grabs one throws it at the rival: ice freezes them (very slow), soap makes
// them slippery. Times are in "play time" ms (only advances while the ball is in play),
// so pauses, goals and replays don't eat into them.
import * as Phaser from 'phaser';
import { FIELD, MID_Y, PLAYER_R, HAZARDS, PALETTE } from '../config.js';
import { SPRITE_SCALE } from '../art.js';
import { floatText } from './juice.js';
import { sfx } from '../sound.js';

const MARGIN = 60; // keep items away from the walls and the halfway line
const SEEK_RANGE = 320; // the bot goes for items this close to it

export default class Hazards {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.nextSpawn = 0;
  }

  // Clears the pitch and schedules the next item (called at every kickoff).
  reset(playTime) {
    for (const item of this.items) item.sprite.destroy();
    this.items = [];
    this.nextSpawn = playTime + Phaser.Math.Between(HAZARDS.spawnMin, HAZARDS.spawnMax);
  }

  update(playTime, players) {
    if (playTime >= this.nextSpawn) {
      if (this.items.length < HAZARDS.maxOnField) this.spawn(playTime, players);
      this.nextSpawn = playTime + Phaser.Math.Between(HAZARDS.spawnMin, HAZARDS.spawnMax);
    }

    for (const item of [...this.items]) {
      const left = item.until - playTime;
      if (left <= 0) {
        this.remove(item, false);
        continue;
      }
      // Blink during the last second and a half so players see it's about to go.
      item.sprite.setAlpha(left < 1500 ? 0.45 + 0.55 * Math.abs(Math.sin(playTime / 90)) : 1);

      const picker = players.find((p) => Math.hypot(p.x - item.x, p.y - item.y) < PLAYER_R + HAZARDS.radius * 0.8);
      if (picker) this.grab(item, picker, players.find((p) => p !== picker));
    }
  }

  spawn(playTime, players) {
    const top = Math.random() < 0.5;
    const yMin = top ? FIELD.top + MARGIN : MID_Y + MARGIN;
    const yMax = top ? MID_Y - MARGIN : FIELD.bottom - MARGIN;
    // Try a few spots that aren't right on top of a player or another item.
    for (let tries = 0; tries < 20; tries++) {
      const x = Phaser.Math.Between(FIELD.left + MARGIN, FIELD.right - MARGIN);
      const y = Phaser.Math.Between(yMin, yMax);
      const crowded = [...players, ...this.items].some((o) => Math.hypot(o.x - x, o.y - y) < 110);
      if (crowded) continue;

      const type = Math.random() < 0.5 ? 'ice' : 'soap';
      const sprite = this.scene.add.image(x, y, type).setDepth(3.5).setScale(0);
      this.scene.tweens.add({ targets: sprite, scale: SPRITE_SCALE * 1.1, duration: 280, ease: 'Back.Out' });
      this.scene.tweens.add({ targets: sprite, angle: { from: -6, to: 6 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.items.push({ type, x, y, sprite, until: playTime + HAZARDS.lifetime });
      sfx.spawn();
      return;
    }
  }

  remove(item, instant) {
    this.items = this.items.filter((i) => i !== item);
    const { sprite } = item;
    this.scene.tweens.killTweensOf(sprite);
    if (instant) {
      sprite.destroy();
      return;
    }
    this.scene.tweens.add({ targets: sprite, scale: 0, alpha: 0, duration: 200, onComplete: () => sprite.destroy() });
  }

  // The picker throws the item at the rival: it spins across the pitch and the effect
  // lands when it arrives.
  grab(item, picker, rival) {
    this.remove(item, true);
    const s = this.scene;
    picker.squash = 0.6;
    sfx.spawn();
    floatText(s, picker.x, picker.y - 50, item.type === 'ice' ? '¡TOMÁ HIELO!' : '¡TOMÁ JABÓN!', PALETTE.white, 22);

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

  // The closest item the bot can reach (in its own half and not too far), or null.
  target(p) {
    let best = null;
    let bestDist = SEEK_RANGE;
    for (const item of this.items) {
      const ownHalf = p.side === 'top' ? item.y < MID_Y : item.y > MID_Y;
      const d = Math.hypot(p.x - item.x, p.y - item.y);
      if (ownHalf && d < bestDist) {
        best = item;
        bestDist = d;
      }
    }
    return best;
  }

  destroy() {
    for (const item of this.items) item.sprite.destroy();
    this.items = [];
  }
}
