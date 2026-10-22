import * as Phaser from 'phaser';
import { GAME_W, COLORS, PALETTE, FONTS } from '../config.js';
import { makeTextures, SPRITE_SCALE } from '../art.js';
import {
  titleText, uiText, ribbon, button, goTo, wipeIn, playMenuMusic, soundButton, controlsButton, controlsPanel,
} from '../ui.js';
import { unlockAudio, sfx } from '../sound.js';
import { loadLeague, totalRounds } from '../league/league.js';
import { loadCup, stageLabel, isFinished as isCupFinished } from '../cup/cup.js';
import { padMenu } from '../gamepads.js';

// Two big buttons, each opening its own page with two cards:
//   PARTIDO NORMAL -> vs the AI, vs a friend (difficulty and power-ups are chosen after
//                     picking the teams, on the "antes de jugar" screen)
//   TORNEO         -> league (clubs), cup (nations)
const CX = GAME_W / 2;
const MAIN = { w: 620, h: 196 };
const SUB = { y: 690, w: 288, h: 250, back: 900 };
const PAGES = {
  main: { keys: ['normal', 'tournament'] },
  normal: { title: 'PARTIDO NORMAL', keys: ['bot', 'pvp'] },
  tournament: { title: 'TORNEO', keys: ['league', 'cup'] },
};
const CARDS = {
  normal: { page: 'main', x: CX, y: 590, ...MAIN, color: COLORS.p1 },
  tournament: { page: 'main', x: CX, y: 830, ...MAIN, color: COLORS.purple },
  bot: { page: 'normal', x: CX - 152, y: SUB.y, w: SUB.w, h: SUB.h, color: COLORS.p1 },
  pvp: { page: 'normal', x: CX + 152, y: SUB.y, w: SUB.w, h: SUB.h, color: COLORS.pink },
  league: { page: 'tournament', x: CX - 152, y: SUB.y, w: SUB.w, h: SUB.h, color: COLORS.purple },
  cup: { page: 'tournament', x: CX + 152, y: SUB.y, w: SUB.w, h: SUB.h, color: COLORS.cyan },
};

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    makeTextures(this);
    wipeIn(this);
    playMenuMusic(this);
    this.page = null;
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

    this.cards = {
      normal: this.makeNormalCard(),
      tournament: this.makeTournamentCard(),
      bot: this.makeBotCard(),
      pvp: this.makePvpCard(),
      league: this.makeLeagueCard(),
      cup: this.makeCupCard(),
    };
    // Sub-page title and "back" button.
    this.pageRibbon = this.add.container(CX, 500);
    this.backBtn = button(this, CX, SUB.back, 280, 62, '◀  VOLVER', () => this.showPage('main'), 24);
    this.backBtn.zone.on('pointerover', () => this.setFocus('back'));

    soundButton(this, GAME_W - 52, 52);
    this.controls = null;
    controlsButton(this, 52, 52, () => this.openControls());

    uiText(this, CX, 1050, 'Flechas elegir  ·  Enter / A entrar  ·  Esc / B volver', 17);
    uiText(this, CX, 1080, 'C / Y: controles  ·  M: sonido', 17, PALETTE.yellow);

    const onKey = (event) => {
      unlockAudio();
      if (this.controls) {
        this.controls.key(event.code);
        return;
      }
      if (event.code === 'KeyC' || event.code === 'Tab') {
        event.preventDefault();
        this.openControls();
        return;
      }
      const dir = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' }[event.code];
      if (dir) this.move(dir);
      else if (event.code === 'Enter' || event.code === 'Space') this.start(this.focus);
      else if (event.code === 'Escape' && this.page !== 'main') this.showPage('main');
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);

    // Coming back from a match or a picker: open the page you were on.
    const remembered = this.registry.get('menuFocus');
    const page = CARDS[remembered]?.page ?? 'main';
    this.showPage(page, true, remembered);
  }

  // ---------- cards ----------

  // Card body + a zone that focuses it on hover and opens it on click.
  makeCard(key, children, title) {
    const { x, y, w, h } = CARDS[key];
    const bg = this.add.graphics();
    const container = this.add.container(x, y, [bg, ...children]);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => this.setFocus(key));
    zone.on('pointerdown', () => this.start(key));
    return { key, container, bg, title, zone };
  }

  cardTitle(x, y, text, size, originX = 0.5) {
    return this.add.text(x, y, text, { fontFamily: FONTS.title, fontSize: `${size}px`, color: PALETTE.white }).setOrigin(originX, 0.5);
  }

  // Left-aligned lines of description under a main card's title.
  cardLines(x, y, lines) {
    return lines.map((line, i) => uiText(this, x, y + i * 30, line, 17).setOrigin(0, 0.5));
  }

  makeNormalCard() {
    const left = -MAIN.w / 2;
    const robot = this.add.image(left + 82, -10, 'robot').setScale(0.48);
    const p1 = this.add.image(left + 150, 30, 'p1').setScale(0.62);
    this.tweens.add({ targets: robot, angle: { from: -5, to: 5 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: p1, y: 22, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const title = this.cardTitle(left + 210, -50, 'PARTIDO NORMAL', 36, 0);
    const lines = this.cardLines(left + 212, 4, [
      '•  Contra la IA: la compu es tu rival',
      '•  Contra un amigo, en la misma compu',
    ]);
    return this.makeCard('normal', [robot, p1, title, ...lines], title);
  }

  makeTournamentCard() {
    const left = -MAIN.w / 2;
    const trophy = this.add.image(left + 100, 0, 'trophy').setScale(0.42);
    this.tweens.add({ targets: trophy, angle: { from: -6, to: 6 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const title = this.cardTitle(left + 210, -50, 'TORNEO', 36, 0);
    const lines = this.cardLines(left + 212, 4, [
      '•  Liga: 20 clubes argentinos, 19 fechas',
      '•  Copa: 48 selecciones del mundo',
    ]);
    return this.makeCard('tournament', [trophy, title, ...lines], title);
  }

  makeBotCard() {
    const robot = this.add.image(0, -50, 'robot').setScale(0.56);
    this.tweens.add({ targets: robot, angle: { from: -5, to: 5 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const title = this.cardTitle(0, 40, 'VS LA IA', 36);
    const sub = uiText(this, 0, 84, 'La compu juega de rival', 16);
    return this.makeCard('bot', [robot, title, sub], title);
  }

  makePvpCard() {
    const p1 = this.add.image(-46, -52, 'p1').setScale(0.76);
    const p2 = this.add.image(46, -52, 'p2').setScale(0.76);
    const vs = titleText(this, 0, -52, 'VS', 24, PALETTE.yellow);
    // The two players bob out of step, like they're facing off.
    this.tweens.add({ targets: p1, y: -60, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: p2, y: -60, duration: 500, delay: 250, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const title = this.cardTitle(0, 40, 'VS AMIGO', 36);
    const sub = uiText(this, 0, 84, 'Los dos en la misma compu', 16);
    return this.makeCard('pvp', [p1, p2, vs, title, sub], title);
  }

  makeLeagueCard() {
    const trophy = this.add.image(0, -46, 'trophy').setScale(0.34);
    this.tweens.add({ targets: trophy, angle: { from: -6, to: 6 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const title = this.cardTitle(0, 40, 'LIGA', 38);
    const saved = loadLeague();
    const subText = saved && saved.round < totalRounds(saved)
      ? `Seguir: fecha ${saved.round + 1} de ${totalRounds(saved)}`
      : '20 clubes  ·  19 fechas';
    const sub = uiText(this, 0, 84, subText, 16);
    return this.makeCard('league', [trophy, title, sub], title);
  }

  makeCupCard() {
    const ball = this.add.image(0, -48, 'ball').setScale(SPRITE_SCALE * 2.8);
    this.tweens.add({ targets: ball, angle: 360, duration: 3000, repeat: -1 });
    const title = this.cardTitle(0, 40, 'COPA', 38);
    const saved = loadCup();
    const subText = saved && !isCupFinished(saved) ? `Seguir: ${stageLabel(saved).split(' · ')[0]}` : '48 selecciones del mundo';
    const sub = uiText(this, 0, 84, subText, 16);
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
      targets: container, scale: active ? 1.05 : 1, angle: active ? -1.5 : 0, alpha: 1,
      duration: 160, ease: 'Back.Out',
    });
  }

  openControls() {
    if (this.controls || this.leaving) return;
    this.controls = controlsPanel(this, () => { this.controls = null; });
  }

  // ---------- pages ----------

  // Shows one page's cards (and, on a sub-page, its title and the "back" button).
  showPage(page, silent = false, focus = null) {
    if (page === this.page) return;
    const from = this.page;
    this.page = page;
    if (!silent) sfx.select();

    for (const card of Object.values(this.cards)) {
      const on = CARDS[card.key].page === page;
      card.container.setVisible(on);
      card.zone.input.enabled = on;
      // Cards pop in (drawCard's tween brings them back to full size and alpha).
      if (on && !silent) card.container.setScale(0.8).setAlpha(0);
    }
    const sub = page !== 'main';
    this.pageRibbon.removeAll(true);
    if (sub) this.pageRibbon.add(ribbon(this, 0, 0, PAGES[page].title, PAGES[page].title.length * 24 + 80, 50));
    this.backBtn.container.setVisible(sub);
    this.backBtn.zone.input.enabled = sub;

    this.focus = null;
    // Going back focuses the card you came from.
    const start = focus && CARDS[focus]?.page === page ? focus : (page === 'main' && from) || PAGES[page].keys[0];
    this.setFocus(start, true);
  }

  // ---------- focus ----------

  setFocus(key, silent = false) {
    if (key === this.focus) return;
    if (key !== 'back' && CARDS[key]?.page !== this.page) return;
    if (!silent) sfx.select();
    this.focus = key;
    if (key !== 'back') this.registry.set('menuFocus', key);
    for (const card of Object.values(this.cards)) {
      if (CARDS[card.key].page === this.page) this.drawCard(card, card.key === key);
    }
    this.backBtn.setActive(key === 'back');
  }

  // Main page: up/down (or left/right) between the two buttons. Sub-pages: left/right
  // between the two cards, down to "volver".
  move(dir) {
    const keys = PAGES[this.page].keys;
    if (this.page === 'main') {
      this.setFocus(keys[dir === 'up' || dir === 'left' ? 0 : 1]);
      return;
    }
    if (this.focus === 'back') {
      if (dir === 'up') this.setFocus(this.registry.get('menuFocus') ?? keys[0]);
      return;
    }
    if (dir === 'down') this.setFocus('back');
    else if (dir === 'left') this.setFocus(keys[0]);
    else if (dir === 'right') this.setFocus(keys[1]);
  }

  start(key) {
    if (this.leaving || !key) return;
    unlockAudio();
    if (key === 'back') return this.showPage('main');
    if (key === 'normal' || key === 'tournament') return this.showPage(key);
    sfx.kickoff();
    // The league and the cup pick up where you left off, or start by choosing a team.
    // Friendlies start by choosing both teams; difficulty and power-ups come right after.
    if (key === 'league') goTo(this, loadLeague() ? 'League' : 'TeamSelect', {});
    else if (key === 'cup') goTo(this, loadCup() ? 'Cup' : 'NationSelect', {});
    else if (key === 'pvp') goTo(this, 'TeamSelect', { purpose: 'friendly', mode: 'pvp' });
    else goTo(this, 'TeamSelect', { purpose: 'friendly', mode: 'bot', level: this.registry.get('botLevel') ?? 'medium' });
  }
}
