import * as Phaser from 'phaser';
import { GAME_W, COLORS, PALETTE, FONTS, WIN_GOALS, BOT_LEVELS } from '../config.js';
import { makeTextures, SPRITE_SCALE } from '../art.js';
import { titleText, uiText, ribbon, goTo, wipeIn, playMenuMusic, soundButton } from '../ui.js';
import { unlockAudio, sfx } from '../sound.js';
import { loadLeague } from '../league/league.js';
import { padMenu } from '../gamepads.js';

// Three cards: the league on top, and two below (1 vs 1 and vs bot). The bot card holds
// its own difficulty picker, shown as 1-3 chili peppers.
const LEVELS = ['easy', 'medium', 'hard'];
const CARDS = {
  league: { x: GAME_W / 2, y: 548, w: 600, h: 132, color: COLORS.purple },
  pvp: { x: GAME_W / 2 - 152, y: 772, w: 288, h: 272, color: COLORS.pink },
  bot: { x: GAME_W / 2 + 152, y: 772, w: 288, h: 272, color: COLORS.p1 },
};
const CHIP = { y: 86, w: 80, h: 70, gap: 88 }; // relative to the bot card

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    makeTextures(this);
    wipeIn(this);
    playMenuMusic(this);
    const cx = GAME_W / 2;
    // Focus is 'league', 'pvp' or one of the bot levels. The chosen level is kept
    // between visits to the menu.
    this.level = this.registry.get('botLevel') ?? 'medium';
    this.focus = null;

    this.add.image(0, 0, 'menuBg').setOrigin(0);

    // Logo: burst + ball behind the tilted title, ribbon underneath.
    const burst = this.add.image(cx + 230, 170, 'burst').setScale(1.3);
    this.tweens.add({ targets: burst, angle: 360, duration: 12000, repeat: -1 });
    const ball = this.add.image(cx + 230, 170, 'ball').setScale(SPRITE_SCALE * 3.2);
    this.tweens.add({ targets: ball, angle: -360, duration: 4000, repeat: -1 });

    const logo = this.add.container(cx, 225, [
      titleText(this, 0, -65, 'TEJO', 112),
      titleText(this, 0, 55, 'FÚTBOL', 112),
      ribbon(this, 0, 158, 'LIGA DE BARRIO', 380, 52),
    ]).setAngle(-7);
    this.tweens.add({ targets: logo, scale: 1.03, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.cards = {
      league: this.makeLeagueCard(),
      pvp: this.makePvpCard(),
      bot: this.makeBotCard(),
    };

    soundButton(this, GAME_W - 52, 52);

    uiText(this, cx, 960, `Liga: partidos de 90 s  ·  Amistosos: gana el primero a ${WIN_GOALS}`, 18, PALETTE.yellow);
    uiText(this, cx, 992, 'Jugador 1 (azul): W A S D + Espacio  ·  Shift izq: dash', 18, '#8fc4ff');
    uiText(this, cx, 1020, 'Jugador 2 (rojo): Flechas + Enter  ·  Shift der: dash', 18, '#ff9aa3');
    uiText(this, cx, 1048, '🎮 Joystick: stick o cruz · A patear · R1 dash · Start pausa', 17, PALETTE.cyan);
    uiText(this, cx, 1082, 'Flechas elegir  ·  Enter / A jugar  ·  M sonido', 16);

    const onKey = (event) => {
      unlockAudio();
      const dir = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' }[event.code];
      if (dir) this.move(dir);
      else if (event.code === 'Enter' || event.code === 'Space') this.start(this.focus);
      else if (/^Digit[1-5]$/.test(event.code)) this.start(['league', 'pvp', ...LEVELS][Number(event.code.slice(-1)) - 1]);
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);

    this.setFocus('league', true);
  }

  // ---------- cards ----------

  // Card body + a zone that focuses it on hover and starts it on click.
  makeCard(key, children, onHover, onClick) {
    const { x, y, w, h } = CARDS[key];
    const bg = this.add.graphics();
    const container = this.add.container(x, y, [bg, ...children]);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', onHover);
    zone.on('pointerdown', onClick);
    return { key, container, bg };
  }

  makeLeagueCard() {
    const { w } = CARDS.league;
    const trophy = this.add.image(-w / 2 + 78, 0, 'trophy').setScale(0.4);
    this.tweens.add({ targets: trophy, angle: { from: -6, to: 6 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const title = this.cardTitle(50, -16, 'LIGA ARGENTINA', 36);
    const sub = uiText(this, 50, 30, '20 equipos  ·  19 fechas  ·  ¡salí campeón!', 17);
    const card = this.makeCard('league', [trophy, title, sub], () => this.setFocus('league'), () => this.start('league'));
    return { ...card, title, icons: [trophy] };
  }

  makePvpCard() {
    const p1 = this.add.image(-50, -62, 'p1').setScale(0.8);
    const p2 = this.add.image(50, -62, 'p2').setScale(0.8);
    const vs = titleText(this, 0, -62, 'VS', 26, PALETTE.yellow);
    // The two players bob out of step, like they're facing off.
    this.tweens.add({ targets: p1, y: -70, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: p2, y: -70, duration: 500, delay: 250, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const title = this.cardTitle(0, 40, '1 VS 1', 40);
    const sub = uiText(this, 0, 88, 'Con un amigo,\nen el mismo teclado', 16).setLineSpacing(-2);
    const card = this.makeCard('pvp', [p1, p2, vs, title, sub], () => this.setFocus('pvp'), () => this.start('pvp'));
    return { ...card, title, icons: [p1, p2] };
  }

  makeBotCard() {
    const robot = this.add.image(0, -78, 'robot').setScale(0.62);
    this.tweens.add({ targets: robot, angle: { from: -5, to: 5 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const title = this.cardTitle(0, 14, 'VS BOT', 40);
    const card = this.makeCard('bot', [robot, title], () => this.setFocus(this.level), () => this.start(this.level));

    // Difficulty chips inside the card; each one has its own zone on top of the card's.
    const { x, y } = CARDS.bot;
    this.chips = LEVELS.map((level, i) => {
      const cxChip = (i - 1) * CHIP.gap;
      const bg = this.add.graphics();
      const chilis = Array.from({ length: i + 1 }, (_, n) =>
        this.add.image(cxChip + (n - i / 2) * 18, CHIP.y - 12, 'chili').setScale(0.42));
      const label = this.add.text(cxChip, CHIP.y + 20, BOT_LEVELS[level].label.toUpperCase(), {
        fontFamily: FONTS.title, fontSize: '14px', color: PALETTE.white, stroke: PALETTE.ink, strokeThickness: 4,
      }).setOrigin(0.5);
      card.container.add([bg, ...chilis, label]);

      const zone = this.add.zone(x + cxChip, y + CHIP.y, CHIP.w, CHIP.h).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.setFocus(level));
      zone.on('pointerdown', () => this.start(level));
      return { level, x: cxChip, bg, label, chilis };
    });
    return { ...card, title, icons: [robot] };
  }

  cardTitle(x, y, text, size) {
    return this.add.text(x, y, text, { fontFamily: FONTS.title, fontSize: `${size}px`, color: PALETTE.white }).setOrigin(0.5);
  }

  drawCard(card, active) {
    const { w, h, color } = CARDS[card.key];
    const { bg, title, container } = card;
    const r = 26;
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

  drawChips() {
    for (const chip of this.chips) {
      const { bg, x } = chip;
      const on = chip.level === this.level;
      const { w, h } = CHIP;
      bg.clear();
      bg.fillStyle(COLORS.ink, on ? 1 : 0.35);
      bg.fillRoundedRect(x - w / 2, CHIP.y - h / 2 + 4, w, h, 16);
      bg.fillStyle(on ? COLORS.white : COLORS.purpleDark, 1);
      bg.fillRoundedRect(x - w / 2, CHIP.y - h / 2, w, h, 16);
      bg.lineStyle(4, COLORS.ink, 1);
      bg.strokeRoundedRect(x - w / 2, CHIP.y - h / 2, w, h, 16);
      chip.label.setColor(on ? PALETTE.ink : PALETTE.white).setStroke(PALETTE.ink, on ? 0 : 4);
      chip.chilis.forEach((c) => c.setAlpha(on ? 1 : 0.55));
    }
  }

  // ---------- focus ----------

  setFocus(focus, silent = false) {
    if (focus === this.focus) return;
    if (!silent) sfx.select();
    this.focus = focus;
    if (LEVELS.includes(focus)) {
      const changed = focus !== this.level;
      this.level = focus;
      this.registry.set('botLevel', focus);
      const chip = this.chips.find((c) => c.level === focus);
      if (changed && !silent) {
        this.tweens.add({ targets: chip.chilis, scale: { from: 0.6, to: 0.42 }, duration: 220, ease: 'Back.Out' });
      }
    }
    const activeCard = LEVELS.includes(focus) ? 'bot' : focus;
    for (const card of Object.values(this.cards)) this.drawCard(card, card.key === activeCard);
    this.drawChips();
  }

  // Arrow keys / stick: league on top; 1 vs 1 and the three bot levels in a row below.
  move(dir) {
    const row = ['pvp', ...LEVELS];
    const f = this.focus;
    if (f === 'league') {
      if (dir === 'down' || dir === 'left') this.setFocus('pvp');
      else if (dir === 'right') this.setFocus(this.level);
    } else if (dir === 'up') {
      this.setFocus('league');
    } else if (dir === 'left' || dir === 'right') {
      const i = row.indexOf(f) + (dir === 'left' ? -1 : 1);
      if (i >= 0 && i < row.length) this.setFocus(row[i]);
    }
  }

  start(focus) {
    if (this.leaving || !focus) return;
    unlockAudio();
    sfx.kickoff();
    // The league picks up where you left off, or starts by choosing a team. Friendlies
    // start by choosing both teams.
    if (focus === 'league') goTo(this, loadLeague() ? 'League' : 'TeamSelect', {});
    else if (focus === 'pvp') goTo(this, 'TeamSelect', { purpose: 'friendly', mode: 'pvp' });
    else goTo(this, 'TeamSelect', { purpose: 'friendly', mode: 'bot', level: focus });
  }
}
