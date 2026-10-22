import * as Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, PALETTE, FONTS } from '../config.js';
import { titleText, uiText, button } from '../ui.js';
import {
  sfx, unlockAudio, getChannel, setChannel, isMuted, toggleMute, onVolumeChange,
} from '../sound.js';
import { playSound } from '../music.js';
import { padMenu } from '../gamepads.js';

const CX = GAME_W / 2;
const CARD = { x: 50, y: 220, w: GAME_W - 100, h: 690 };
const ROW = { first: 400, gap: 96, h: 80 };
const BAR = { left: 345, seg: 22, gap: 3 }; // ten segments, one per 10 %
const SLIDERS = [
  { ch: 'music', label: 'MÚSICA', sub: 'Menú y partido' },
  { ch: 'crowd', label: 'HINCHADA', sub: 'Cantos, gol y uuuh' },
  { ch: 'sfx', label: 'EFECTOS', sub: 'Patadas, rebotes, botones' },
];
const MUTE_ROW = SLIDERS.length;
const DONE_ROW = SLIDERS.length + 1;
const CROWD_PREVIEW_MS = 900; // the "uuuh" plays at most this often while adjusting

// Sound settings, opened over any screen with openSoundPanel() (ui.js): one slider per
// volume channel (music, crowd, effects), a "mute everything" switch and "¡LISTO!".
// The screen below stays paused until it closes.
export default class SoundScene extends Phaser.Scene {
  constructor() {
    super('Sound');
  }

  init(data) {
    this.from = data.from;
    this.focus = 0;
    this.lastCrowdPreview = 0;
    this.closing = false;
  }

  create() {
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.75).setOrigin(0).setInteractive();
    dim.on('pointerdown', () => this.close());

    const g = this.add.graphics();
    const { x, y, w, h } = CARD;
    g.fillStyle(COLORS.ink, 1);
    g.fillRoundedRect(x - 6, y + 8, w + 12, h, 30);
    g.fillStyle(COLORS.purpleDark, 1);
    g.fillRoundedRect(x, y, w, h, 28);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 14, y + 12, w - 28, 50, 20);
    g.lineStyle(6, COLORS.ink, 1);
    g.strokeRoundedRect(x, y, w, h, 28);
    // Clicks on the card land here instead of on the dim layer, which closes it.
    this.add.zone(CX, y + h / 2, w, h).setInteractive();
    titleText(this, CX, y + 70, 'SONIDO', 60).setAngle(-3);

    this.rows = SLIDERS.map((s, i) => this.makeSlider(s, ROW.first + i * ROW.gap, i));
    this.muteBtn = button(this, CX, ROW.first + MUTE_ROW * ROW.gap + 4, w - 100, 66, '', () => this.pressMute(), 22);
    this.muteBtn.zone.on('pointerover', () => this.setFocus(MUTE_ROW));
    this.doneBtn = button(this, CX, ROW.first + DONE_ROW * ROW.gap + 4, 240, 64, '¡LISTO!', () => this.close(), 26);
    this.doneBtn.zone.on('pointerover', () => this.setFocus(DONE_ROW));
    uiText(this, CX, y + h - 28, '↑ ↓ elegir  ·  ← → subir o bajar  ·  M: silenciar  ·  Esc: cerrar', 14, '#bfb3ff');

    const stop = onVolumeChange(() => this.refresh());
    this.events.once('shutdown', stop);

    const onKey = (event) => {
      unlockAudio();
      const c = event.code;
      if (c === 'ArrowUp' || c === 'KeyW') this.setFocus((this.focus + DONE_ROW) % (DONE_ROW + 1));
      else if (c === 'ArrowDown' || c === 'KeyS') this.setFocus((this.focus + 1) % (DONE_ROW + 1));
      else if (c === 'ArrowLeft' || c === 'KeyA') this.nudge(-1);
      else if (c === 'ArrowRight' || c === 'KeyD') this.nudge(1);
      else if (c === 'Enter' || c === 'Space') {
        if (this.focus === MUTE_ROW) this.pressMute();
        else if (this.focus === DONE_ROW) this.close();
        else this.setFocus(this.focus + 1);
      } else if (c === 'KeyM') this.pressMute();
      else if (c === 'Escape') this.close();
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);

    this.refresh();
    this.setFocus(0, true);
  }

  // Label + ◀ [ten segments] ▶ + percentage. Every part is clickable.
  makeSlider({ ch, label, sub }, y, index) {
    const bg = this.add.graphics();
    uiText(this, CARD.x + 40, y - 11, label, 22).setOrigin(0, 0.5);
    uiText(this, CARD.x + 40, y + 17, sub, 13, '#bfb3ff').setOrigin(0, 0.5);
    const bar = this.add.graphics();
    const percent = this.add.text(CARD.x + CARD.w - 40, y, '', {
      fontFamily: FONTS.title, fontSize: '20px', color: PALETTE.white, stroke: PALETTE.ink, strokeThickness: 5,
    }).setOrigin(1, 0.5);

    const rowZone = this.add.zone(CX, y, CARD.w - 40, ROW.h).setInteractive();
    rowZone.on('pointerover', () => this.setFocus(index));
    const barW = 10 * BAR.seg + 9 * BAR.gap;
    for (const [dir, ax] of [[-1, BAR.left - 26], [1, BAR.left + barW + 26]]) {
      const arrow = titleText(this, ax, y, dir < 0 ? '◀' : '▶', 22, PALETTE.yellow);
      const zone = this.add.zone(ax, y, 40, ROW.h).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.setFocus(index));
      zone.on('pointerdown', () => {
        this.setFocus(index, true);
        this.nudge(dir);
      });
      arrow.setDepth(1);
    }
    // Clicking a segment sets that level (the first one again turns it off).
    for (let i = 0; i < 10; i++) {
      const sx = BAR.left + i * (BAR.seg + BAR.gap) + BAR.seg / 2;
      const zone = this.add.zone(sx, y, BAR.seg + BAR.gap, ROW.h).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.setFocus(index));
      zone.on('pointerdown', () => {
        const level = (i + 1) / 10;
        this.setLevel(ch, getChannel(ch) === level && i === 0 ? 0 : level);
      });
    }
    return { ch, y, bg, bar, percent };
  }

  // ---------- changes ----------

  nudge(dir) {
    if (this.focus >= SLIDERS.length) {
      if (this.focus === MUTE_ROW) this.pressMute();
      return;
    }
    const { ch } = this.rows[this.focus];
    this.setLevel(ch, getChannel(ch) + dir * 0.1);
  }

  setLevel(ch, level) {
    unlockAudio();
    // Moving a slider while muted brings the sound back.
    if (isMuted()) toggleMute();
    setChannel(ch, level);
    // A little preview at the new level.
    if (ch === 'sfx') sfx.select();
    else if (ch === 'crowd' && this.time.now - this.lastCrowdPreview > CROWD_PREVIEW_MS) {
      this.lastCrowdPreview = this.time.now;
      playSound('ooh');
    }
  }

  pressMute() {
    unlockAudio();
    toggleMute();
    sfx.select();
  }

  refresh() {
    const muted = isMuted();
    for (const row of this.rows) {
      const level = getChannel(row.ch);
      const on = Math.round(level * 10);
      row.bar.clear();
      for (let i = 0; i < 10; i++) {
        const sx = BAR.left + i * (BAR.seg + BAR.gap);
        const segH = 18 + i * 2.4; // a little ramp, like a volume meter
        row.bar.fillStyle(COLORS.ink, 1);
        row.bar.fillRoundedRect(sx, row.y + 20 - segH + 3, BAR.seg, segH, 5);
        row.bar.fillStyle(i < on ? (muted ? 0x8a84a8 : COLORS.yellow) : 0x3a2a78, 1);
        row.bar.fillRoundedRect(sx, row.y + 20 - segH, BAR.seg, segH, 5);
      }
      row.percent.setText(muted ? 'MUDO' : `${on * 10}%`).setColor(muted ? '#ff9aa3' : PALETTE.white);
    }
    this.muteBtn.container.list[1].setText(`SILENCIAR TODO:   ${muted ? 'SÍ' : 'NO'}`);
  }

  setFocus(index, silent = false) {
    if (index !== this.focus && !silent) sfx.select();
    this.focus = index;
    this.rows.forEach((row, i) => {
      const on = i === index;
      row.bg.clear();
      if (!on) return;
      row.bg.fillStyle(COLORS.purple, 1);
      row.bg.fillRoundedRect(CARD.x + 20, row.y - ROW.h / 2, CARD.w - 40, ROW.h, 18);
      row.bg.lineStyle(4, COLORS.yellow, 1);
      row.bg.strokeRoundedRect(CARD.x + 20, row.y - ROW.h / 2, CARD.w - 40, ROW.h, 18);
    });
    this.muteBtn.setActive(index === MUTE_ROW);
    this.doneBtn.setActive(index === DONE_ROW);
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    sfx.back();
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
