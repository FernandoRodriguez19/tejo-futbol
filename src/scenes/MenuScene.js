import * as Phaser from 'phaser';
import { GAME_W, COLORS, PALETTE, FONTS, WIN_GOALS } from '../config.js';
import { makeTextures, SPRITE_SCALE } from '../art.js';
import { titleText, uiText, ribbon, goTo, wipeIn, playMenuMusic } from '../ui.js';
import { unlockAudio, sfx } from '../sound.js';
import { loadLeague } from '../league/league.js';
import { padMenu } from '../gamepads.js';

const OPTIONS = [
  { label: 'LIGA ARGENTINA', league: true },
  { label: '1 VS 1', data: { mode: 'pvp' } },
  { label: 'VS BOT · FÁCIL', data: { mode: 'bot', level: 'easy' } },
  { label: 'VS BOT · MEDIO', data: { mode: 'bot', level: 'medium' } },
  { label: 'VS BOT · DIFÍCIL', data: { mode: 'bot', level: 'hard' } },
];
const BTN_W = 400;
const BTN_H = 64;

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    makeTextures(this);
    wipeIn(this);
    playMenuMusic(this);
    const cx = GAME_W / 2;
    this.selected = 0;

    this.add.image(0, 0, 'menuBg').setOrigin(0);

    // Logo: burst + ball behind the tilted title, ribbon underneath.
    const burst = this.add.image(cx + 230, 190, 'burst').setScale(1.3);
    this.tweens.add({ targets: burst, angle: 360, duration: 12000, repeat: -1 });
    const ball = this.add.image(cx + 230, 190, 'ball').setScale(SPRITE_SCALE * 3.2);
    this.tweens.add({ targets: ball, angle: -360, duration: 4000, repeat: -1 });

    const logo = this.add.container(cx, 250, [
      titleText(this, 0, -70, 'TEJO', 120),
      titleText(this, 0, 60, 'FÚTBOL', 120),
      ribbon(this, 0, 170, 'LIGA DE BARRIO', 400, 56),
    ]).setAngle(-7);
    this.tweens.add({ targets: logo, scale: 1.03, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.buttons = OPTIONS.map((opt, i) => this.makeButton(cx, 535 + i * 82, opt.label, i));

    uiText(this, cx, 930, `Liga: partidos de 90 s  ·  Amistosos: gana el primero a ${WIN_GOALS}`, 18, PALETTE.yellow);
    uiText(this, cx, 965, 'Jugador 1 (azul): W A S D + Espacio  ·  Shift izq: dash', 19, '#8fc4ff');
    uiText(this, cx, 995, 'Jugador 2 (rojo): Flechas + Enter  ·  Shift der: dash', 19, '#ff9aa3');
    uiText(this, cx, 1030, '🎮 Joystick: stick o cruz · A patear · R1 dash · Start pausa', 18, PALETTE.cyan);
    uiText(this, cx, 1068, '↑ ↓ elegir   ·   Enter / A jugar   ·   Esc / B vuelve', 16);

    const onKey = (event) => {
      unlockAudio();
      if (event.code === 'ArrowUp' || event.code === 'KeyW') this.select((this.selected + OPTIONS.length - 1) % OPTIONS.length);
      else if (event.code === 'ArrowDown' || event.code === 'KeyS') this.select((this.selected + 1) % OPTIONS.length);
      else if (event.code === 'Enter' || event.code === 'Space') this.start(this.selected);
      else if (/^Digit[1-5]$/.test(event.code)) this.start(Number(event.code.slice(-1)) - 1);
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);

    this.select(0, true);
  }

  makeButton(x, y, label, index) {
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, label, {
      fontFamily: FONTS.title, fontSize: '28px', color: PALETTE.white,
    }).setOrigin(0.5);
    const container = this.add.container(x, y, [bg, text]);

    const zone = this.add.zone(x, y, BTN_W, BTN_H).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => this.select(index));
    zone.on('pointerdown', () => this.start(index));

    return { container, bg, text };
  }

  drawButton(btn, active) {
    const { bg, text } = btn;
    const w = BTN_W;
    const h = BTN_H;
    bg.clear();
    bg.fillStyle(COLORS.ink, 1);
    bg.fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 18); // drop shadow
    bg.fillStyle(active ? COLORS.yellow : COLORS.purple, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.fillStyle(0xffffff, 0.25);
    bg.fillRoundedRect(-w / 2 + 8, -h / 2 + 6, w - 16, h * 0.32, 10);
    bg.lineStyle(5, COLORS.ink, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);

    text.setColor(active ? PALETTE.ink : PALETTE.white);
    text.setStroke(active ? PALETTE.yellow : PALETTE.ink, active ? 0 : 6);
    btn.container.setScale(active ? 1.06 : 1).setAngle(active ? -2 : 0);
  }

  select(index, silent = false) {
    if (index !== this.selected && !silent) sfx.select();
    this.selected = index;
    this.buttons.forEach((btn, i) => this.drawButton(btn, i === index));
  }

  start(index) {
    if (this.leaving) return;
    unlockAudio();
    sfx.kickoff();
    const opt = OPTIONS[index];
    // The league picks up where you left off, or starts by choosing a team. Friendlies
    // start by choosing both teams.
    if (opt.league) goTo(this, loadLeague() ? 'League' : 'TeamSelect', {});
    else goTo(this, 'TeamSelect', { purpose: 'friendly', ...opt.data });
  }
}
