import * as Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, PALETTE } from '../config.js';
import { makeTextures, kitTexture } from '../art.js';
import {
  titleText, uiText, button, goTo, wipeIn, playMenuMusic, optionsButton, sportsCard, levelBadge, levelOf, starsOf,
} from '../ui.js';
import { sfx, unlockAudio } from '../sound.js';
import { TEAMS, pickKits } from '../league/teams.js';
import { newLeague, saveLeague } from '../league/league.js';
import SetupPanel from '../setupPanel.js';
import { padMenu } from '../gamepads.js';

const CX = GAME_W / 2;
const CARD = { x: 50, y: 170, w: GAME_W - 100, h: 520 };
const STRIP = { top: 772, perRow: 10, step: 68, rowGap: 78, thumbScale: 0.42 };
const CHOOSE_Y = 990;

// One line under the stars, by how strong the club is.
function tagline(strength) {
  if (strength >= 0.9) return '¡UNO DE LOS GRANDES DEL FÚTBOL ARGENTINO!';
  if (strength >= 0.75) return 'SIEMPRE PELEA ARRIBA';
  if (strength >= 0.55) return 'UN RIVAL DURO PARA CUALQUIERA';
  return '¡A DAR LA SORPRESA!';
}

// FIFA-style club picker (same look as the cup's NationSelectScene): a big card with the
// selected club (home and away kits, level, stars) and a strip with the 20 kits below.
// Left/right browse the clubs, up/down jump between the two rows of the strip.
// For a league you pick one club. For a friendly (1 vs 1 or vs bot) you pick two: first
// player 1's, then player 2's (or the bot's).
export default class TeamSelectScene extends Phaser.Scene {
  constructor() {
    super('TeamSelect');
  }

  // data.purpose: 'league' (default) | 'friendly'; friendlies also get data.mode
  // ('pvp' | 'bot') and data.level (bot difficulty).
  init(data) {
    this.purpose = data.purpose ?? 'league';
    this.friendly = { mode: data.mode, level: data.level };
    this.picks = [];
    this.setup = null;
    this.index = 0;
  }

  create() {
    makeTextures(this);
    wipeIn(this);
    playMenuMusic(this);
    this.add.image(0, 0, 'menuBg').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.6).setOrigin(0);

    this.titleTxt = titleText(this, CX, 72, '', 50).setAngle(-3);
    this.subTxt = uiText(this, CX, 132, '', 19, PALETTE.yellow);
    optionsButton(this, GAME_W - 48, 48);

    this.makeCard();
    this.makeStrip();
    this.chooseBtn = button(this, CX, CHOOSE_Y, 460, 70, '', () => this.confirm(), 26);
    this.chooseBtn.setActive(true);
    uiText(this, CX, GAME_H - 44, '← → equipo  ·  ↑ ↓ fila  ·  Enter / A: elegir  ·  Esc / B: volver', 16);

    this.updateTitles();
    this.show();

    const onKey = (event) => {
      unlockAudio();
      if (this.setup) {
        this.setup.key(event.code);
        return;
      }
      const n = TEAMS.length;
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -STRIP.perRow, ArrowDown: STRIP.perRow, KeyA: -1, KeyD: 1, KeyW: -STRIP.perRow, KeyS: STRIP.perRow };
      if (moves[event.code]) this.select((this.index + moves[event.code] + n) % n);
      else if (event.code === 'Enter' || event.code === 'Space') this.confirm();
      else if (event.code === 'Escape') this.back();
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);
  }

  get team() {
    return TEAMS[this.index];
  }

  // ---------- building ----------

  makeCard() {
    sportsCard(this, CARD);

    this.homeKit = this.add.image(CX - 60, 345, kitTexture(this, TEAMS[0].home, '10')).setScale(1.7);
    this.tweens.add({ targets: this.homeKit, y: 333, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.awayKit = this.add.image(CX + 215, 372, kitTexture(this, TEAMS[0].away, '10')).setScale(0.95);
    uiText(this, CX + 215, 446, 'SUPLENTE', 15, '#bfb3ff');
    this.badge = levelBadge(this, CARD.x + 78, CARD.y + 84);

    this.nameText = titleText(this, CX, 530, '', 50);
    this.starsText = uiText(this, CX, 592, '', 30, PALETTE.yellow);
    this.tagText = uiText(this, CX, 645, '', 18, '#bfb3ff');

    // Big arrows on the sides of the card.
    for (const dir of [-1, 1]) {
      const ax = dir < 0 ? CARD.x - 4 : CARD.x + CARD.w + 4;
      const arrow = titleText(this, ax, CARD.y + CARD.h / 2, dir < 0 ? '◀' : '▶', 44, PALETTE.yellow);
      this.tweens.add({ targets: arrow, x: ax + dir * 6, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const zone = this.add.zone(ax, CARD.y + CARD.h / 2, 70, 120).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.select((this.index + dir + TEAMS.length) % TEAMS.length));
    }
    const cardZone = this.add.zone(CX, CARD.y + CARD.h / 2, CARD.w - 140, CARD.h).setInteractive({ useHandCursor: true });
    cardZone.on('pointerdown', () => this.confirm());
  }

  // The 20 home kits in two rows; click one to see it, click it again to pick it.
  makeStrip() {
    const left = CX - ((STRIP.perRow - 1) * STRIP.step) / 2;
    this.thumbs = TEAMS.map((team, i) => {
      const x = left + (i % STRIP.perRow) * STRIP.step;
      const y = STRIP.top + Math.floor(i / STRIP.perRow) * STRIP.rowGap;
      const frame = this.add.graphics();
      const img = this.add.image(0, 0, kitTexture(this, team.home, '')).setScale(STRIP.thumbScale);
      const thumb = this.add.container(x, y, [frame, img]);
      const zone = this.add.zone(x, y, STRIP.step, STRIP.rowGap - 6).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => (i === this.index ? this.confirm() : this.select(i)));
      return { thumb, frame };
    });
    this.counter = uiText(this, CX, STRIP.top + STRIP.rowGap + 56, '', 16, '#bfb3ff');
  }

  updateTitles() {
    if (this.purpose === 'league') {
      this.titleTxt.setText('ELEGÍ TU EQUIPO');
      this.subTxt.setText('Liga de 19 fechas · partidos de 90 segundos');
      return;
    }
    const vsBot = this.friendly.mode === 'bot';
    if (this.picks.length === 0) {
      this.titleTxt.setText('JUGADOR 1: ELEGÍ');
      this.subTxt.setText(vsBot ? 'Primero tu equipo, después el del bot' : 'Primero el jugador 1 (abajo), después el jugador 2 (arriba)');
    } else {
      this.titleTxt.setText(vsBot ? 'ELEGÍ EL RIVAL' : 'JUGADOR 2: ELEGÍ');
      this.subTxt.setText(`Jugador 1 juega con ${TEAMS[this.picks[0]].short}  ·  Esc: cambiar`);
    }
  }

  // ---------- selection ----------

  select(index) {
    if (index === this.index) return;
    this.index = index;
    sfx.select();
    this.show();
  }

  show() {
    const t = this.team;
    this.thumbs.forEach(({ thumb, frame }, i) => {
      const on = i === this.index;
      frame.clear();
      if (on) {
        frame.fillStyle(COLORS.ink, 1);
        frame.fillCircle(2, 4, 31);
        frame.fillStyle(COLORS.yellow, 1);
        frame.fillCircle(0, 0, 31);
      }
      this.tweens.killTweensOf(thumb);
      this.tweens.add({ targets: thumb, scale: on ? 1.2 : 0.95, duration: 150, ease: 'Back.Out' });
      thumb.setDepth(on ? 2 : 1).setAlpha(on ? 1 : 0.8);
    });
    this.counter.setText(`${this.index + 1} / ${TEAMS.length}`);

    this.homeKit.setTexture(kitTexture(this, t.home, '10'));
    this.awayKit.setTexture(kitTexture(this, t.away, '10'));
    const name = t.name.toUpperCase();
    this.nameText.setText(name).setFontSize(name.length > 12 ? 42 : 50);
    this.starsText.setText(starsOf(t.strength));
    this.tagText.setText(tagline(t.strength));
    this.badge.setLevel(levelOf(t.strength));
    this.chooseBtn.container.list[1].setText(`ELEGIR ${t.short}`);

    // Little pop when the club changes.
    // (Only the pop tween is stopped: the home kit keeps its bobbing one.)
    this.homePop?.stop();
    this.tweens.killTweensOf(this.awayKit);
    this.homeKit.setScale(1.45);
    this.homePop = this.tweens.add({ targets: this.homeKit, scale: 1.7, duration: 260, ease: 'Back.Out' });
    this.awayKit.setScale(0.75);
    this.tweens.add({ targets: this.awayKit, scale: 0.95, duration: 260, ease: 'Back.Out' });
  }

  // Esc: undo player 1's pick, or leave.
  back() {
    if (this.purpose === 'friendly' && this.picks.length) {
      this.picks.pop();
      this.tag?.destroy();
      this.tag = null;
      sfx.back();
      this.updateTitles();
      return;
    }
    goTo(this, 'Menu');
  }

  openSetup(opts) {
    this.setup = new SetupPanel(this, { ...opts, onClosed: () => { this.setup = null; } });
  }

  // Small "J1" tag on the strip kit player 1 picked.
  addTag(index) {
    const { thumb } = this.thumbs[index];
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 1);
    g.fillRoundedRect(-22, -12, 44, 24, 8);
    g.fillStyle(COLORS.p1, 1);
    g.fillRoundedRect(-19, -9, 38, 18, 6);
    const label = uiText(this, 0, 0, 'J1', 14);
    this.tag = this.add.container(thumb.x + 20, thumb.y - 26, [g, label]).setDepth(5).setAngle(8);
  }

  confirm() {
    if (this.leaving || this.setup) return;
    unlockAudio();
    sfx.confirm();
    const index = this.index;

    if (this.purpose === 'league') {
      const team = TEAMS[index];
      this.openSetup({
        icons: [{ texture: kitTexture(this, team.home, '10'), scale: 0.55 }],
        subtitle: `Liga con ${team.short}  ·  los grandes siempre son más difíciles`,
        difficulty: 'medium',
        onStart: ({ difficulty, hazards }) => {
          saveLeague(newLeague(team.id, difficulty, hazards));
          goTo(this, 'League', { view: 'table' });
        },
      });
      return;
    }

    this.picks.push(index);
    if (this.picks.length === 1) {
      this.addTag(index);
      this.updateTitles();
      return;
    }
    // Both may pick the same team: the second one then wears the alternative kit.
    const t1 = TEAMS[this.picks[0]];
    const t2 = TEAMS[this.picks[1]];
    const kits = pickKits(t1, t2);
    const vsBot = this.friendly.mode === 'bot';
    this.openSetup({
      icons: [
        { texture: kitTexture(this, kits.home, '10'), scale: 0.55 },
        { texture: kitTexture(this, kits.away, '9'), scale: 0.55 },
      ],
      subtitle: `${t1.short} vs ${t2.short}${vsBot ? ' (bot)' : ''}  ·  gana el primero a 5 goles`,
      difficulty: vsBot ? this.friendly.level : null,
      rememberBotLevel: true,
      onStart: ({ difficulty, hazards }) => goTo(this, 'Game', {
        mode: this.friendly.mode,
        level: difficulty ?? this.friendly.level,
        teams: { p1: t1.id, p2: t2.id },
        hazards,
      }),
      // Back to choosing player 2's team.
      onCancel: () => this.picks.pop(),
    });
  }
}
