import * as Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, PALETTE, FONTS } from '../config.js';
import { makeTextures, kitTexture } from '../art.js';
import { titleText, uiText, ribbon, button, goTo, wipeIn, playMenuMusic, soundButton } from '../ui.js';
import { sfx, unlockAudio } from '../sound.js';
import { TEAM_BY_ID, pickKits } from '../league/teams.js';
import {
  loadLeague, clearLeague, standings, nextUserMatch, isFinished, totalRounds, recordUserMatch,
} from '../league/league.js';
import { padMenu } from '../gamepads.js';

const CX = GAME_W / 2;
const HINT = '← → / cruz: elegir botón  ·  Enter / A: aceptar  ·  Tab / Y: tabla o resultados  ·  Esc / B: menú';
const ROW_H = 33;
const TABLE_TOP = 175;
// Column centres for the numeric stats.
const COLS = [
  ['PJ', 420], ['G', 465], ['E', 510], ['P', 555], ['GF', 605], ['GC', 655], ['DG', 705], ['PTS', 765],
];

// League hub: standings, last round's results, next match and the final screen.
export default class LeagueScene extends Phaser.Scene {
  constructor() {
    super('League');
  }

  init(data) {
    this.view = data.view ?? null; // null: table, or the final screen if the league is over
  }

  create() {
    makeTextures(this);
    wipeIn(this);
    playMenuMusic(this);
    this.league = loadLeague();
    if (!this.league) {
      this.scene.start('TeamSelect');
      return;
    }
    this.user = TEAM_BY_ID[this.league.userId];
    this.modal = null;

    this.add.image(0, 0, 'menuBg').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.62).setOrigin(0);
    this.content = this.add.container(0, 0);

    const finished = isFinished(this.league);
    if (!this.view) this.view = finished ? 'final' : 'table';
    if (this.view === 'results' && !this.league.results.length) this.view = 'table';
    if (finished && this.view === 'results') this.view = 'final';

    this.drawHeader();
    soundButton(this, GAME_W - 48, 48);
    this.drawFooter();
    this.render();

    const onKey = (event) => {
      unlockAudio();
      if (this.modal) {
        this.modalKey(event.code);
        return;
      }
      const n = this.footer.length;
      if (event.code === 'ArrowLeft' || event.code === 'KeyA' || event.code === 'ArrowUp' || event.code === 'KeyW') {
        this.focusFooter((this.focus + n - 1) % n);
      } else if (event.code === 'ArrowRight' || event.code === 'KeyD' || event.code === 'ArrowDown' || event.code === 'KeyS') {
        this.focusFooter((this.focus + 1) % n);
      } else if (event.code === 'Enter' || event.code === 'Space') {
        this.footer[this.focus].action();
      } else if (event.code === 'Tab') {
        event.preventDefault();
        this.toggleView();
      } else if (event.code === 'Escape') goTo(this, 'Menu');
      else if (event.code === 'KeyN') this.openResetModal();
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);
  }

  // ---------- layout ----------

  drawHeader() {
    const round = Math.min(this.league.round + 1, totalRounds(this.league));
    ribbon(this, CX, 58, 'LIGA ARGENTINA', 380, 54).setAngle(-2);
    const level = { easy: 'FÁCIL', medium: 'MEDIO', hard: 'DIFÍCIL' }[this.league.difficulty ?? 'medium']
      + (this.league.hazards ? '  ·  HIELO Y JABÓN' : '');
    const subtitle = isFinished(this.league)
      ? `TORNEO TERMINADO  ·  ${level}`
      : `FECHA ${round} DE ${totalRounds(this.league)}  ·  ${this.user.short}  ·  ${level}`;
    uiText(this, CX, 120, subtitle, 20, PALETTE.yellow);
  }

  drawFooter() {
    const finished = isFinished(this.league);
    const btnY = 1018;

    if (!finished) {
      const m = nextUserMatch(this.league);
      const home = TEAM_BY_ID[m.home];
      const away = TEAM_BY_ID[m.away];
      const kits = pickKits(home, away);
      const rowY = 940;
      uiText(this, CX, 898, 'PRÓXIMO PARTIDO', 18, PALETTE.yellow);
      this.add.image(CX - 250, rowY, kitTexture(this, kits.home, '10')).setScale(0.38);
      uiText(this, CX - 220, rowY, home.short, 22).setOrigin(0, 0.5);
      uiText(this, CX, rowY, 'VS', 22, PALETTE.yellow);
      uiText(this, CX + 220, rowY, away.short, 22).setOrigin(1, 0.5);
      this.add.image(CX + 250, rowY, kitTexture(this, kits.away, '9')).setScale(0.38);
    }

    // Footer buttons, left to right. Arrows / joystick move the yellow highlight and
    // Enter / A presses it; the main button starts highlighted.
    const footer = [];
    if (finished) {
      this.viewBtn = button(this, CX - 220, btnY, 230, 66, '', () => this.toggleView(), 20);
      footer.push([this.viewBtn, () => this.toggleView()]);
      this.mainBtn = button(this, CX + 110, btnY, 360, 66, 'NUEVA LIGA', () => this.mainAction(), 26);
      footer.push([this.mainBtn, () => this.mainAction()]);
    } else {
      this.viewBtn = button(this, 130, btnY, 200, 66, '', () => this.toggleView(), 19);
      footer.push([this.viewBtn, () => this.toggleView()]);
      const quit = button(this, 342, btnY, 200, 66, 'ABANDONAR', () => this.openResetModal(), 19);
      footer.push([quit, () => this.openResetModal()]);
      this.mainBtn = button(this, 610, btnY, 320, 66, `JUGAR FECHA ${this.league.round + 1}`, () => this.mainAction(), 24);
      footer.push([this.mainBtn, () => this.mainAction()]);
    }
    this.footer = footer.map(([btn, action]) => ({ btn, action }));
    this.footer.forEach((item, i) => item.btn.zone.on('pointerover', () => this.focusFooter(i)));
    this.focusFooter(this.footer.length - 1, true);
    this.updateViewButton();

    this.hint = uiText(this, CX, GAME_H - 28, HINT, 15);
  }

  focusFooter(index, silent = false) {
    if (index !== this.focus && !silent) sfx.select();
    this.focus = index;
    this.footer.forEach((item, i) => {
      item.btn.setActive(i === index);
      item.btn.container.setScale(i === index ? 1.05 : 1);
    });
  }

  updateViewButton() {
    const label = this.view === 'table' ? (isFinished(this.league) ? 'CAMPEÓN' : 'RESULTADOS') : 'TABLA';
    this.viewBtn.container.list[1].setText(label);
  }

  render() {
    this.content.removeAll(true);
    if (this.view === 'table') this.renderTable();
    else if (this.view === 'results') this.renderResults();
    else this.renderFinal();
  }

  toggleView() {
    sfx.select();
    if (this.view === 'table') {
      if (isFinished(this.league)) this.view = 'final';
      else if (this.league.results.length) this.view = 'results';
      else return;
    } else {
      this.view = 'table';
    }
    this.updateViewButton();
    this.render();
  }

  mainAction() {
    if (isFinished(this.league)) {
      this.openResetModal();
      return;
    }
    const m = nextUserMatch(this.league);
    const home = TEAM_BY_ID[m.home];
    const away = TEAM_BY_ID[m.away];
    const kits = pickKits(home, away);
    const rival = m.userIsHome ? away : home;
    if (this.leaving) return;
    sfx.kickoff();
    goTo(this, 'Game', {
      mode: 'league',
      match: {
        user: this.user,
        rival,
        userKit: m.userIsHome ? kits.home : kits.away,
        rivalKit: m.userIsHome ? kits.away : kits.home,
        difficulty: this.league.difficulty,
        hazards: this.league.hazards,
        knockout: false,
        record: (userGoals, rivalGoals) => recordUserMatch(this.league, userGoals, rivalGoals),
        back: { scene: 'League', data: { view: 'results' } },
      },
    });
  }

  // ---------- abandon / new league ----------

  // Starting over throws the current league away, so it asks first. "NO" is selected by
  // default so a stray Enter can't wipe the league.
  openResetModal() {
    if (this.modal || this.leaving) return;
    sfx.select();
    const finished = isFinished(this.league);
    const title = finished ? '¿EMPEZAR OTRA LIGA?' : '¿ABANDONAR LA LIGA?';
    const detail = finished
      ? 'Elegís un equipo nuevo y arranca desde la fecha 1.'
      : `Se pierde la campaña de ${this.user.short} (fecha ${this.league.round + 1} de ${totalRounds(this.league)})\ny empezás de nuevo eligiendo equipo.`;

    // The dim layer swallows clicks so nothing behind the dialog reacts.
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.75).setOrigin(0).setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.ink, 1);
    panel.fillRoundedRect(CX - 316, 400, 632, 330, 26);
    panel.fillStyle(COLORS.purpleDark, 1);
    panel.fillRoundedRect(CX - 310, 394, 620, 330, 24);
    panel.lineStyle(5, COLORS.ink, 1);
    panel.strokeRoundedRect(CX - 310, 394, 620, 330, 24);
    const heading = titleText(this, CX, 470, title, 40);
    const text = uiText(this, CX, 555, detail, 19).setLineSpacing(6);
    const no = button(this, CX - 150, 655, 260, 64, finished ? 'NO' : 'NO, SEGUIR', () => this.closeModal(), 22);
    const yes = button(this, CX + 150, 655, 260, 64, finished ? 'SÍ, NUEVA' : 'SÍ, ABANDONAR', () => this.confirmReset(), 22);

    this.modal = {
      sel: 0,
      buttons: [no, yes],
      parts: [dim, panel, heading, text, no.container, no.zone, yes.container, yes.zone],
    };
    for (const part of this.modal.parts) part.setDepth(100);
    this.selectModal(0);
  }

  selectModal(sel) {
    this.modal.sel = sel;
    this.modal.buttons.forEach((b, i) => b.setActive(i === sel));
  }

  modalKey(code) {
    if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD') {
      sfx.select();
      this.selectModal(1 - this.modal.sel);
    } else if (code === 'Enter' || code === 'Space') {
      if (this.modal.sel === 1) this.confirmReset();
      else this.closeModal();
    } else if (code === 'Escape' || code === 'KeyN') {
      this.closeModal();
    }
  }

  closeModal() {
    if (!this.modal) return;
    sfx.select();
    for (const part of this.modal.parts) part.destroy();
    this.modal = null;
  }

  confirmReset() {
    clearLeague();
    sfx.kickoff();
    goTo(this, 'TeamSelect');
  }

  // ---------- views ----------

  renderTable() {
    const add = (obj) => this.content.add(obj);
    const g = this.add.graphics();
    add(g);
    const x0 = 30;
    const w = GAME_W - 60;
    const rows = standings(this.league);
    const prev = this.league.prevPositions;

    g.fillStyle(COLORS.ink, 0.92);
    g.fillRoundedRect(x0 - 6, TABLE_TOP - 6, w + 12, ROW_H * 21 + 16, 18);
    g.fillStyle(COLORS.purple, 1);
    g.fillRoundedRect(x0, TABLE_TOP, w, ROW_H, { tl: 12, tr: 12, bl: 0, br: 0 });

    const head = { fontFamily: FONTS.ui, fontStyle: '900', fontSize: '15px', color: PALETTE.white };
    add(this.add.text(x0 + 24, TABLE_TOP + ROW_H / 2, '#', head).setOrigin(0.5));
    add(this.add.text(x0 + 95, TABLE_TOP + ROW_H / 2, 'EQUIPO', head).setOrigin(0, 0.5));
    for (const [label, cx] of COLS) add(this.add.text(cx, TABLE_TOP + ROW_H / 2, label, head).setOrigin(0.5));

    rows.forEach((r, i) => {
      const y = TABLE_TOP + ROW_H * (i + 1);
      const cy = y + ROW_H / 2;
      const isUser = r.id === this.league.userId;
      const team = TEAM_BY_ID[r.id];

      if (isUser) g.fillStyle(COLORS.yellow, 1);
      else g.fillStyle(i % 2 ? 0x2a1a5c : 0x24164f, 1);
      g.fillRect(x0, y, w, ROW_H);
      if (i === 0) {
        // Leader marker.
        g.fillStyle(COLORS.yellow, 1);
        g.fillRect(x0, y, 6, ROW_H);
      }

      const color = isUser ? PALETTE.ink : PALETTE.white;
      const cell = { fontFamily: FONTS.ui, fontStyle: '900', fontSize: '17px', color };
      add(this.add.text(x0 + 24, cy, String(r.pos), cell).setOrigin(0.5));

      if (prev && prev[r.id] && prev[r.id] !== r.pos) {
        const up = r.pos < prev[r.id];
        add(this.add.text(x0 + 50, cy, up ? '▲' : '▼', { ...cell, fontSize: '12px', color: up ? '#3dd68c' : '#ff4757' }).setOrigin(0.5));
      }
      add(this.add.image(x0 + 78, cy, kitTexture(this, team.home, '')).setScale(0.2));
      add(this.add.text(x0 + 95, cy, team.short, cell).setOrigin(0, 0.5));
      const stats = [r.pj, r.pg, r.pe, r.pp, r.gf, r.gc, r.dg > 0 ? `+${r.dg}` : r.dg, r.pts];
      COLS.forEach(([label, cx], k) => {
        const style = label === 'PTS' ? { ...cell, fontFamily: FONTS.title, fontSize: '18px' } : cell;
        add(this.add.text(cx, cy, String(stats[k]), style).setOrigin(0.5));
      });
    });
  }

  renderResults() {
    const add = (obj) => this.content.add(obj);
    const round = this.league.results[this.league.results.length - 1];
    add(uiText(this, CX, TABLE_TOP + 10, `RESULTADOS DE LA FECHA ${this.league.results.length}`, 24));

    const g = this.add.graphics();
    add(g);
    round.forEach((res, i) => {
      const y = TABLE_TOP + 60 + i * 62;
      const home = TEAM_BY_ID[res.home];
      const away = TEAM_BY_ID[res.away];
      g.fillStyle(res.user ? COLORS.yellow : COLORS.ink, res.user ? 1 : 0.88);
      g.fillRoundedRect(40, y - 26, GAME_W - 80, 52, 14);
      const color = res.user ? PALETTE.ink : PALETTE.white;
      const style = { fontFamily: FONTS.ui, fontStyle: '900', fontSize: '20px', color };
      add(this.add.image(70, y, kitTexture(this, home.home, '')).setScale(0.26));
      add(this.add.text(CX - 70, y, home.short, style).setOrigin(1, 0.5));
      add(this.add.text(CX, y, `${res.hg} - ${res.ag}`, { ...style, fontFamily: FONTS.title, fontSize: '24px' }).setOrigin(0.5));
      add(this.add.text(CX + 70, y, away.short, style).setOrigin(0, 0.5));
      add(this.add.image(GAME_W - 70, y, kitTexture(this, away.home, '')).setScale(0.26));
    });
  }

  renderFinal() {
    const add = (obj) => this.content.add(obj);
    const rows = standings(this.league);
    const champion = TEAM_BY_ID[rows[0].id];
    const mine = rows.find((r) => r.id === this.league.userId);
    const won = mine.pos === 1;

    const burst = this.add.image(CX, 400, 'burst').setScale(3.2).setAlpha(won ? 1 : 0.35);
    add(burst);
    this.tweens.add({ targets: burst, angle: 360, duration: 16000, repeat: -1 });
    add(this.add.image(CX, 400, 'trophy').setScale(0.95));
    add(this.add.image(CX + 105, 450, kitTexture(this, champion.home, '10')).setScale(0.75));

    if (won) {
      add(titleText(this, CX, 640, '¡CAMPEÓN!', 100).setAngle(-5));
      add(ribbon(this, CX, 735, this.user.short, 380, 56).setAngle(-5));
      add(uiText(this, CX, 820, `${mine.pts} puntos  ·  ${mine.pg} ganados  ·  DG ${mine.dg > 0 ? '+' : ''}${mine.dg}`, 24, PALETTE.yellow));
      sfx.win();
      this.time.addEvent({ delay: 700, repeat: 4, callback: () => this.confetti() });
    } else {
      add(titleText(this, CX, 640, `TERMINASTE ${mine.pos}º`, 72).setAngle(-4));
      add(ribbon(this, CX, 735, `CAMPEÓN: ${champion.short}`, 440, 56).setAngle(-4));
      add(uiText(this, CX, 820, `${this.user.short}: ${mine.pts} puntos  ·  ¡La próxima es tuya!`, 22, PALETTE.yellow));
    }
  }

  confetti() {
    const colors = [COLORS.pink, COLORS.yellow, COLORS.cyan, COLORS.purple, 0xffffff];
    for (let i = 0; i < 40; i++) {
      const piece = this.add.rectangle(Phaser.Math.Between(0, GAME_W), -20, 9, 15, Phaser.Utils.Array.GetRandom(colors))
        .setStrokeStyle(2, COLORS.ink);
      this.tweens.add({
        targets: piece,
        y: GAME_H + 20,
        x: piece.x + Phaser.Math.Between(-120, 120),
        angle: Phaser.Math.Between(-720, 720),
        duration: Phaser.Math.Between(1800, 3000),
        onComplete: () => piece.destroy(),
      });
    }
  }
}
