import * as Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, PALETTE } from '../config.js';
import { makeTextures, kitTexture } from '../art.js';
import { titleText, uiText, button, goTo, wipeIn, playMenuMusic, soundButton } from '../ui.js';
import { sfx, unlockAudio } from '../sound.js';
import { TEAMS, pickKits } from '../league/teams.js';
import { newLeague, saveLeague } from '../league/league.js';
import { NATIONS } from '../cup/nations.js';
import { newCup, saveCup, CUP_SIZES } from '../cup/cup.js';
import { padMenu } from '../gamepads.js';

// Grid layouts: the 20 clubs in big cells, the 48 nations in small ones.
const GRIDS = {
  clubs: { cols: 4, w: 180, h: 150, gap: 12, top: 270, kitScale: 0.62, kitY: -26, nameY: 34, starsY: 58, nameSize: 18, starSize: 15 },
  nations: { cols: 8, w: 92, h: 118, gap: 6, top: 238, kitScale: 0.42, kitY: -24, nameY: 18, starsY: 40, nameSize: 11, starSize: 10 },
};
const CUP_FORMATS = [
  { id: 'groups', label: 'FASE DE GRUPOS' },
  { id: 'knockout', label: 'ELIMINACIÓN DIRECTA' },
];
const LEAGUE_LEVELS = [
  { id: 'easy', label: 'FÁCIL' },
  { id: 'medium', label: 'MEDIO' },
  { id: 'hard', label: 'DIFÍCIL' },
];

// Team picker. For a league you pick one club, for the cup one nation. For a friendly
// (1 vs 1 or vs bot) you pick two clubs: first player 1's, then player 2's (or the bot's).
export default class TeamSelectScene extends Phaser.Scene {
  constructor() {
    super('TeamSelect');
  }

  // data.purpose: 'league' (default) | 'cup' | 'friendly'; friendlies also get data.mode
  // ('pvp' | 'bot') and data.level (bot difficulty).
  init(data) {
    this.purpose = data.purpose ?? 'league';
    this.friendly = { mode: data.mode, level: data.level };
    this.teams = this.purpose === 'cup' ? NATIONS : TEAMS;
    this.grid = this.purpose === 'cup' ? GRIDS.nations : GRIDS.clubs;
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

    const G = this.grid;
    const left = GAME_W / 2 - ((G.w + G.gap) * G.cols - G.gap) / 2 + G.w / 2;
    this.cells = this.teams.map((team, i) => {
      const x = left + (i % G.cols) * (G.w + G.gap);
      const y = G.top + Math.floor(i / G.cols) * (G.h + G.gap);
      const bg = this.add.graphics();
      const kit = this.add.image(0, G.kitY, kitTexture(this, team.home, '10')).setScale(G.kitScale);
      const long = team.short.length > (G === GRIDS.nations ? 9 : 11);
      const name = uiText(this, 0, G.nameY, team.short, long ? G.nameSize - 2 : G.nameSize);
      const stars = Math.max(1, Math.round(team.strength * 5));
      const rating = uiText(this, 0, G.starsY, '★'.repeat(stars) + '☆'.repeat(5 - stars), G.starSize, PALETTE.yellow);
      const container = this.add.container(x, y, [bg, kit, name, rating]);

      const zone = this.add.zone(x, y, G.w, G.h).setInteractive({ useHandCursor: true });
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
      const n = this.teams.length;
      const cols = this.grid.cols;
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols, KeyA: -1, KeyD: 1, KeyW: -cols, KeyS: cols };
      if (moves[event.code]) this.select((this.selected + moves[event.code] + n) % n);
      else if (event.code === 'Enter' || event.code === 'Space') this.confirm(this.selected);
      else if (event.code === 'Escape') this.back();
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);
  }

  updateTitles() {
    if (this.purpose === 'cup') {
      this.titleTxt.setText('ELEGÍ TU SELECCIÓN');
      this.subTxt.setText('Copa de naciones · 48 selecciones · partidos de 90 segundos');
      return;
    }
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
      this.subTxt.setText(`Jugador 1 juega con ${this.teams[this.picks[0]].short}  ·  Esc: cambiar`);
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
  //   kits: kits to show at the top; extraRows: more { key, label, values, index } rows
  //   shown first (the cup's format and size); difficulty: starting level id, or null
  //   to hide the row; onChange(row, rows): lets a row update the others;
  //   onStart({ difficulty, hazards, ...extra keys }); onCancel: Esc / B.
  openSetup({ kits, subtitle, extraRows = [], difficulty, onChange, onStart, onCancel }) {
    const cx = GAME_W / 2;
    const rows = [...extraRows];
    if (difficulty) {
      rows.push({ key: 'difficulty', label: 'DIFICULTAD', values: LEAGUE_LEVELS, index: LEAGUE_LEVELS.findIndex((l) => l.id === difficulty) });
    }
    // Remembers the last choice for the next match.
    rows.push({ key: 'hazards', label: 'POWER-UPS', values: [{ id: false, label: 'NO' }, { id: true, label: 'SÍ' }], index: this.registry.get('hazards') ? 1 : 0 });

    const top = rows.length > 2 ? 230 : 290;
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

    this.setup = { rows, play, parts, onStart, onCancel, onChange, focus: rows.length };
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
    this.setup.onChange?.(row, this.setup.rows);
    this.setup.rows.forEach((r) => this.refreshRow(r));
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
    // Next time the screen starts with these same choices.
    this.registry.set('hazards', settings.hazards);
    if (settings.difficulty && this.purpose === 'friendly') this.registry.set('botLevel', settings.difficulty);
    sfx.kickoff();
    this.setup.onStart(settings);
  }

  // Cup options: format, size (depends on the format), difficulty and power-ups.
  openCupSetup(nation) {
    const sizeValues = (format) => CUP_SIZES[format].map((n) => ({
      id: n,
      label: format === 'groups' ? `${n} (${n / 4} GRUPOS)` : `${n} EQUIPOS`,
    }));
    const formatRow = { key: 'format', label: 'FORMATO', values: CUP_FORMATS, index: 0 };
    const sizeRow = { key: 'size', label: 'EQUIPOS', values: sizeValues('groups'), index: 0 };
    this.openSetup({
      kits: [nation.home],
      subtitle: `Copa con ${nation.short}  ·  si achicás la copa juegan los mejores`,
      extraRows: [formatRow, sizeRow],
      difficulty: 'medium',
      // Changing the format swaps the size options, keeping the closest size.
      onChange: (row) => {
        if (row !== formatRow) return;
        const current = sizeRow.values[sizeRow.index].id;
        sizeRow.values = sizeValues(CUP_FORMATS[formatRow.index].id);
        const sizes = sizeRow.values.map((v) => v.id);
        const closest = sizes.reduce((best, n) => (Math.abs(n - current) < Math.abs(best - current) ? n : best), sizes[0]);
        sizeRow.index = sizes.indexOf(closest);
      },
      onStart: ({ format, size, difficulty, hazards }) => {
        saveCup(newCup(nation.id, { format, size, difficulty, hazards }));
        goTo(this, 'Cup', {});
      },
    });
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
    this.badge = this.add.container(cell.x + this.grid.w / 2 - 24, cell.y - this.grid.h / 2 + 6, [g, label]).setDepth(5).setAngle(8);
  }

  select(index, silent = false) {
    if (index !== this.selected && !silent) sfx.select();
    this.selected = index;
    this.cells.forEach((cell, i) => {
      const active = i === index;
      const g = cell.bg;
      g.clear();
      g.fillStyle(COLORS.ink, 1);
      const { w, h } = this.grid;
      g.fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 18);
      g.fillStyle(active ? COLORS.yellow : COLORS.purple, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
      g.fillStyle(0xffffff, 0.18);
      g.fillRoundedRect(-w / 2 + 8, -h / 2 + 6, w - 16, Math.min(26, h * 0.2), 10);
      g.lineStyle(5, COLORS.ink, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
      cell.rating.setColor(active ? PALETTE.purpleDark : PALETTE.yellow);
      cell.container.setScale(active ? 1.07 : 1).setDepth(active ? 2 : 1);
    });
  }

  confirm(index) {
    if (this.leaving) return;
    unlockAudio();
    sfx.kickoff();

    if (this.purpose === 'cup') {
      this.openCupSetup(this.teams[index]);
      return;
    }

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
