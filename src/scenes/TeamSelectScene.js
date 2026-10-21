import * as Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, PALETTE } from '../config.js';
import { makeTextures, kitTexture } from '../art.js';
import { titleText, uiText, button, goTo, wipeIn, playMenuMusic, soundButton } from '../ui.js';
import { sfx, unlockAudio } from '../sound.js';
import { TEAMS, pickKits } from '../league/teams.js';
import { newLeague, saveLeague } from '../league/league.js';
import { padMenu } from '../gamepads.js';

const COLS = 4;
const CELL_W = 180;
const CELL_H = 150;
const GAP = 12;
const LEAGUE_LEVELS = [
  { id: 'easy', label: 'FÁCIL' },
  { id: 'medium', label: 'MEDIO' },
  { id: 'hard', label: 'DIFÍCIL' },
];

// Team picker. For a league you pick one team. For a friendly (1 vs 1 or vs bot) you pick
// two: first player 1's team, then player 2's (or the bot's).
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
  }

  create() {
    makeTextures(this);
    wipeIn(this);
    playMenuMusic(this);
    this.add.image(0, 0, 'menuBg').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.55).setOrigin(0);

    this.titleTxt = titleText(this, GAME_W / 2, 80, '', 54).setAngle(-3);
    this.subTxt = uiText(this, GAME_W / 2, 150, '', 20, PALETTE.yellow);
    soundButton(this, GAME_W - 48, 48);

    const left = GAME_W / 2 - ((CELL_W + GAP) * COLS - GAP) / 2 + CELL_W / 2;
    this.cells = TEAMS.map((team, i) => {
      const x = left + (i % COLS) * (CELL_W + GAP);
      const y = 270 + Math.floor(i / COLS) * (CELL_H + GAP);
      const bg = this.add.graphics();
      const kit = this.add.image(0, -26, kitTexture(this, team.home, '10')).setScale(0.62);
      const name = uiText(this, 0, 34, team.short, team.short.length > 11 ? 15 : 18);
      const stars = Math.max(1, Math.round(team.strength * 5));
      const rating = uiText(this, 0, 58, '★'.repeat(stars) + '☆'.repeat(5 - stars), 15, PALETTE.yellow);
      const container = this.add.container(x, y, [bg, kit, name, rating]);

      const zone = this.add.zone(x, y, CELL_W, CELL_H).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.select(i));
      zone.on('pointerdown', () => this.confirm(i));
      return { container, bg, rating };
    });

    uiText(this, GAME_W / 2, GAME_H - 50, 'Flechas / cruz: elegir   ·   Enter / A: confirmar   ·   Esc / B: volver', 18);

    this.selected = 0;
    this.select(0, true);
    this.updateTitles();

    const onKey = (event) => {
      unlockAudio();
      if (this.setup) {
        this.setupKey(event.code);
        return;
      }
      const n = TEAMS.length;
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS, KeyA: -1, KeyD: 1, KeyW: -COLS, KeyS: COLS };
      if (moves[event.code]) this.select((this.selected + moves[event.code] + n) % n);
      else if (event.code === 'Enter' || event.code === 'Space') this.confirm(this.selected);
      else if (event.code === 'Escape') this.back();
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);
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

  // Esc: undo player 1's pick, or leave.
  back() {
    if (this.purpose === 'friendly' && this.picks.length) {
      this.picks.pop();
      this.badge?.destroy();
      this.badge = null;
      sfx.select();
      this.updateTitles();
      return;
    }
    goTo(this, 'Menu');
  }

  // ---------- "antes de jugar" options ----------

  // Options panel shown after picking the team(s): difficulty (league and vs bot) and
  // the ice & soap hazards, then "¡A JUGAR!". Up/down picks a row, left/right (or
  // Enter / click) changes its value.
  //   kits: kits to show at the top; difficulty: starting level id, or null to hide
  //   the row; onStart({ difficulty, hazards }); onCancel: Esc / B.
  openSetup({ kits, subtitle, difficulty, onStart, onCancel }) {
    const cx = GAME_W / 2;
    const rows = [];
    if (difficulty) {
      rows.push({ key: 'difficulty', label: 'DIFICULTAD', values: LEAGUE_LEVELS, index: LEAGUE_LEVELS.findIndex((l) => l.id === difficulty) });
    }
    rows.push({ key: 'hazards', label: 'HIELO Y JABÓN', values: [{ id: false, label: 'NO' }, { id: true, label: 'SÍ' }], index: 0 });

    const top = 290;
    const height = 240 + rows.length * 90 + 110;
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.78).setOrigin(0).setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.ink, 1);
    panel.fillRoundedRect(cx - 316, top + 6, 632, height, 26);
    panel.fillStyle(COLORS.purpleDark, 1);
    panel.fillRoundedRect(cx - 310, top, 620, height, 24);
    panel.lineStyle(5, COLORS.ink, 1);
    panel.strokeRoundedRect(cx - 310, top, 620, height, 24);
    const parts = [dim, panel];

    kits.forEach((kit, i) => {
      const x = cx + (i - (kits.length - 1) / 2) * 150;
      parts.push(this.add.image(x, top + 62, kitTexture(this, kit, i === 0 ? '10' : '9')).setScale(0.55));
    });
    if (kits.length === 2) parts.push(titleText(this, cx, top + 62, 'VS', 34, PALETTE.yellow));
    parts.push(titleText(this, cx, top + 140, 'ANTES DE JUGAR', 40));
    parts.push(uiText(this, cx, top + 186, subtitle, 17, PALETTE.yellow));

    rows.forEach((row, i) => {
      row.btn = button(this, cx, top + 250 + i * 90, 500, 66, '', () => {
        this.focusSetup(i);
        this.changeSetup(1);
      }, 22);
      row.btn.zone.on('pointerover', () => this.focusSetup(i));
      parts.push(row.btn.container, row.btn.zone);
    });
    const hazardsY = top + 250 + (rows.length - 1) * 90;
    parts.push(uiText(this, cx, hazardsY + 48, 'Pegale con la pelota al hielo o al jabón para congelar o hacer patinar al rival', 15, PALETTE.cyan));

    const playY = top + height - 60;
    const play = button(this, cx, playY, 340, 70, '¡A JUGAR!', () => this.startSetup(), 30);
    play.zone.on('pointerover', () => this.focusSetup(rows.length));
    parts.push(play.container, play.zone);
    parts.push(uiText(this, cx, top + height + 34, '↑ ↓ elegir  ·  ← → cambiar  ·  Enter / A: aceptar  ·  Esc / B: volver', 15));

    this.setup = { rows, play, parts, onStart, onCancel, focus: rows.length };
    for (const part of parts) part.setDepth(100);
    rows.forEach((row) => this.refreshRow(row));
    this.focusSetup(rows.length, true);
  }

  refreshRow(row) {
    row.btn.container.list[1].setText(`${row.label}:   ◀  ${row.values[row.index].label}  ▶`);
  }

  focusSetup(index, silent = false) {
    const s = this.setup;
    if (index !== s.focus && !silent) sfx.select();
    s.focus = index;
    [...s.rows.map((r) => r.btn), s.play].forEach((b, i) => {
      b.setActive(i === index);
      b.container.setScale(i === index ? 1.05 : 1);
    });
  }

  changeSetup(step) {
    const row = this.setup.rows[this.setup.focus];
    if (!row) return;
    sfx.select();
    row.index = (row.index + step + row.values.length) % row.values.length;
    this.refreshRow(row);
  }

  setupKey(code) {
    const s = this.setup;
    const n = s.rows.length + 1;
    if (code === 'ArrowUp' || code === 'KeyW') this.focusSetup((s.focus + n - 1) % n);
    else if (code === 'ArrowDown' || code === 'KeyS') this.focusSetup((s.focus + 1) % n);
    else if (code === 'ArrowLeft' || code === 'KeyA') this.changeSetup(-1);
    else if (code === 'ArrowRight' || code === 'KeyD') this.changeSetup(1);
    else if (code === 'Enter' || code === 'Space') {
      if (s.focus === s.rows.length) this.startSetup();
      else this.changeSetup(1);
    } else if (code === 'Escape') this.closeSetup(true);
  }

  closeSetup(cancelled) {
    const s = this.setup;
    for (const part of s.parts) part.destroy();
    this.setup = null;
    if (cancelled) {
      sfx.select();
      s.onCancel?.();
    }
  }

  startSetup() {
    if (this.leaving) return;
    const settings = { difficulty: null, hazards: false };
    for (const row of this.setup.rows) settings[row.key] = row.values[row.index].id;
    sfx.kickoff();
    this.setup.onStart(settings);
  }

  // Small "J1" tag on the team player 1 picked.
  addBadge(index) {
    const cell = this.cells[index].container;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink, 1);
    g.fillRoundedRect(-30, -16, 60, 32, 10);
    g.fillStyle(COLORS.p1, 1);
    g.fillRoundedRect(-27, -13, 54, 26, 8);
    const label = uiText(this, 0, 0, 'J1', 18);
    this.badge = this.add.container(cell.x + CELL_W / 2 - 24, cell.y - CELL_H / 2 + 6, [g, label]).setDepth(5).setAngle(8);
  }

  select(index, silent = false) {
    if (index !== this.selected && !silent) sfx.select();
    this.selected = index;
    this.cells.forEach((cell, i) => {
      const active = i === index;
      const g = cell.bg;
      g.clear();
      g.fillStyle(COLORS.ink, 1);
      g.fillRoundedRect(-CELL_W / 2, -CELL_H / 2 + 6, CELL_W, CELL_H, 18);
      g.fillStyle(active ? COLORS.yellow : COLORS.purple, 1);
      g.fillRoundedRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, 18);
      g.fillStyle(0xffffff, 0.18);
      g.fillRoundedRect(-CELL_W / 2 + 8, -CELL_H / 2 + 6, CELL_W - 16, 26, 10);
      g.lineStyle(5, COLORS.ink, 1);
      g.strokeRoundedRect(-CELL_W / 2, -CELL_H / 2, CELL_W, CELL_H, 18);
      cell.rating.setColor(active ? PALETTE.purpleDark : PALETTE.yellow);
      cell.container.setScale(active ? 1.07 : 1).setDepth(active ? 2 : 1);
    });
  }

  confirm(index) {
    if (this.leaving) return;
    unlockAudio();
    sfx.kickoff();

    if (this.purpose === 'league') {
      const team = TEAMS[index];
      this.openSetup({
        kits: [team.home],
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
      this.addBadge(index);
      this.updateTitles();
      return;
    }
    // Both may pick the same team: the second one then wears the alternative kit.
    const t1 = TEAMS[this.picks[0]];
    const t2 = TEAMS[this.picks[1]];
    const kits = pickKits(t1, t2);
    const vsBot = this.friendly.mode === 'bot';
    this.openSetup({
      kits: [kits.home, kits.away],
      subtitle: `${t1.short} vs ${t2.short}${vsBot ? ' (bot)' : ''}  ·  gana el primero a 5 goles`,
      difficulty: vsBot ? this.friendly.level : null,
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
