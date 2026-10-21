import * as Phaser from 'phaser';
import { GAME_W, COLORS, PALETTE, FONTS } from '../config.js';
import { makeTextures, SPRITE_SCALE } from '../art.js';
import { titleText, uiText, ribbon, goTo, wipeIn, playMenuMusic, soundButton } from '../ui.js';
import { unlockAudio, sfx } from '../sound.js';
import { loadLeague, totalRounds } from '../league/league.js';
import { loadCup, stageLabel, isFinished as isCupFinished } from '../cup/cup.js';
import { padMenu } from '../gamepads.js';

// Two sections of two cards each, in a 2 x 2 grid:
//   PARTIDO NORMAL: vs the AI, vs a friend (difficulty and power-ups are chosen after
//                   picking the teams, on the "antes de jugar" screen)
//   CAMPEONATO:     league (clubs), cup (nations)
const CX = GAME_W / 2;
const CARDS = {
  bot: { col: 0, row: 0, x: CX - 152, y: 614, w: 288, h: 196, color: COLORS.p1 },
  pvp: { col: 1, row: 0, x: CX + 152, y: 614, w: 288, h: 196, color: COLORS.pink },
  league: { col: 0, row: 1, x: CX - 152, y: 882, w: 288, h: 176, color: COLORS.purple },
  cup: { col: 1, row: 1, x: CX + 152, y: 882, w: 288, h: 176, color: COLORS.cyan },
};
const ORDER = ['bot', 'pvp', 'league', 'cup'];

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    makeTextures(this);
    wipeIn(this);
    playMenuMusic(this);
    this.focus = null;

    this.add.image(0, 0, 'menuBg').setOrigin(0);

    // Logo: burst + ball behind the tilted title, ribbon underneath.
    const burst = this.add.image(CX + 230, 160, 'burst').setScale(1.2);
    this.tweens.add({ targets: burst, angle: 360, duration: 12000, repeat: -1 });
    const ball = this.add.image(CX + 230, 160, 'ball').setScale(SPRITE_SCALE * 3);
    this.tweens.add({ targets: ball, angle: -360, duration: 4000, repeat: -1 });
    const logo = this.add.container(CX, 205, [
      titleText(this, 0, -60, 'TEJO', 104),
      titleText(this, 0, 50, 'FÚTBOL', 104),
      ribbon(this, 0, 146, 'LIGA DE BARRIO', 360, 48),
    ]).setAngle(-7);
    this.tweens.add({ targets: logo, scale: 1.03, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // Section titles.
    ribbon(this, CX, 470, 'PARTIDO NORMAL', 360, 46);
    ribbon(this, CX, 752, 'CAMPEONATO', 320, 46);

    this.cards = {
      bot: this.makeBotCard(),
      pvp: this.makePvpCard(),
      league: this.makeLeagueCard(),
      cup: this.makeCupCard(),
    };

    soundButton(this, GAME_W - 52, 52);

    uiText(this, CX, 990, 'Jugador 1 (azul): W A S D + Espacio  ·  Shift izq: dash', 18, '#8fc4ff');
    uiText(this, CX, 1018, 'Jugador 2 (rojo): Flechas + Enter  ·  Shift der: dash', 18, '#ff9aa3');
    uiText(this, CX, 1046, '🎮 Joystick: stick o cruz · A patear · R1 dash · Start pausa', 17, PALETTE.cyan);
    uiText(this, CX, 1082, 'Flechas elegir  ·  Enter / A entrar  ·  M sonido', 16);

    const onKey = (event) => {
      unlockAudio();
      const dir = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' }[event.code];
      if (dir) this.move(dir);
      else if (event.code === 'Enter' || event.code === 'Space') this.start(this.focus);
      else if (/^Digit[1-4]$/.test(event.code)) this.start(ORDER[Number(event.code.slice(-1)) - 1]);
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);

    this.setFocus(this.registry.get('menuFocus') ?? 'bot', true);
  }

  // ---------- cards ----------

  // Card body + a zone that focuses it on hover and starts it on click.
  makeCard(key, children, title) {
    const { x, y, w, h } = CARDS[key];
    const bg = this.add.graphics();
    const container = this.add.container(x, y, [bg, ...children]);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => this.setFocus(key));
    zone.on('pointerdown', () => this.start(key));
    return { key, container, bg, title };
  }

  cardTitle(y, text, size) {
    return this.add.text(0, y, text, { fontFamily: FONTS.title, fontSize: `${size}px`, color: PALETTE.white }).setOrigin(0.5);
  }

  makeBotCard() {
    const robot = this.add.image(0, -42, 'robot').setScale(0.5);
    this.tweens.add({ targets: robot, angle: { from: -5, to: 5 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const title = this.cardTitle(36, 'VS LA IA', 34);
    const sub = uiText(this, 0, 74, 'La compu juega de rival', 15);
    return this.makeCard('bot', [robot, title, sub], title);
  }

  makePvpCard() {
    const p1 = this.add.image(-46, -44, 'p1').setScale(0.72);
    const p2 = this.add.image(46, -44, 'p2').setScale(0.72);
    const vs = titleText(this, 0, -44, 'VS', 24, PALETTE.yellow);
    // The two players bob out of step, like they're facing off.
    this.tweens.add({ targets: p1, y: -52, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: p2, y: -52, duration: 500, delay: 250, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const title = this.cardTitle(36, 'VS AMIGO', 34);
    const sub = uiText(this, 0, 74, 'Los dos en la misma compu', 15);
    return this.makeCard('pvp', [p1, p2, vs, title, sub], title);
  }

  makeLeagueCard() {
    const trophy = this.add.image(0, -36, 'trophy').setScale(0.3);
    this.tweens.add({ targets: trophy, angle: { from: -6, to: 6 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const title = this.cardTitle(32, 'LIGA', 36);
    const saved = loadLeague();
    const subText = saved && saved.round < totalRounds(saved)
      ? `Seguir: fecha ${saved.round + 1} de ${totalRounds(saved)}`
      : '20 equipos  ·  19 fechas';
    const sub = uiText(this, 0, 66, subText, 15);
    return this.makeCard('league', [trophy, title, sub], title);
  }

  makeCupCard() {
    const ball = this.add.image(0, -38, 'ball').setScale(SPRITE_SCALE * 2.4);
    this.tweens.add({ targets: ball, angle: 360, duration: 3000, repeat: -1 });
    const title = this.cardTitle(30, 'COPA', 36);
    const saved = loadCup();
    const subText = saved && !isCupFinished(saved) ? `Seguir: ${stageLabel(saved).split(' · ')[0]}` : '48 selecciones del mundo';
    const sub = uiText(this, 0, 66, subText, 15);
    return this.makeCard('cup', [ball, title, sub], title);
  }

  drawCard(card, active) {
    const { w, h, color } = CARDS[card.key];
    const { bg, title, container } = card;
    const r = 24;
    bg.clear();
    bg.fillStyle(COLORS.ink, 1);
    bg.fillRoundedRect(-w / 2, -h / 2 + 8, w, h, r); // drop shadow
    bg.fillStyle(active ? COLORS.yellow : color, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    bg.fillStyle(0xffffff, 0.22);
    bg.fillRoundedRect(-w / 2 + 10, -h / 2 + 8, w - 20, Math.min(40, h * 0.22), 14);
    bg.lineStyle(6, COLORS.ink, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

    title.setColor(active ? PALETTE.ink : PALETTE.white);
    title.setStroke(PALETTE.ink, active ? 0 : 7);
    this.tweens.killTweensOf(container);
    this.tweens.add({
      targets: container, scale: active ? 1.05 : 1, angle: active ? -1.5 : 0,
      duration: 160, ease: 'Back.Out',
    });
  }

  // ---------- focus ----------

  setFocus(key, silent = false) {
    if (key === this.focus || !CARDS[key]) return;
    if (!silent) sfx.select();
    this.focus = key;
    this.registry.set('menuFocus', key);
    for (const card of Object.values(this.cards)) this.drawCard(card, card.key === key);
  }

  // Arrow keys / stick move around the 2 x 2 grid.
  move(dir) {
    const { col, row } = CARDS[this.focus];
    const target = {
      left: [col - 1, row], right: [col + 1, row], up: [col, row - 1], down: [col, row + 1],
    }[dir];
    const key = ORDER.find((k) => CARDS[k].col === target[0] && CARDS[k].row === target[1]);
    if (key) this.setFocus(key);
  }

  start(key) {
    if (this.leaving || !key) return;
    unlockAudio();
    sfx.kickoff();
    // The league picks up where you left off, or starts by choosing a team. Friendlies
    // start by choosing both teams; difficulty and power-ups come right after.
    if (key === 'league') goTo(this, loadLeague() ? 'League' : 'TeamSelect', {});
    else if (key === 'cup') goTo(this, loadCup() ? 'Cup' : 'TeamSelect', loadCup() ? {} : { purpose: 'cup' });
    else if (key === 'pvp') goTo(this, 'TeamSelect', { purpose: 'friendly', mode: 'pvp' });
    else goTo(this, 'TeamSelect', { purpose: 'friendly', mode: 'bot', level: this.registry.get('botLevel') ?? 'medium' });
  }
}
