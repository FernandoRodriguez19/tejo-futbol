import * as Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, PALETTE, FONTS } from '../config.js';
import { makeTextures } from '../art.js';
import { flagTexture } from '../cup/flags.js';
import { titleText, uiText, ribbon, button, goTo, wipeIn, playMenuMusic, soundButton, levelLabel } from '../ui.js';
import { sfx, unlockAudio } from '../sound.js';
import { pickKits } from '../league/teams.js';
import { NATION_BY_ID } from '../cup/nations.js';
import {
  loadCup, clearCup, nextUserMatch, recordUserMatch, simulateToEnd, groupStandings,
  currentRound, roundName, stageLabel, isFinished,
} from '../cup/cup.js';
import { padMenu } from '../gamepads.js';

const CX = GAME_W / 2;
const HINT = '← → / cruz: elegir botón  ·  Enter / A: aceptar  ·  Tab / Y: cambiar vista  ·  Esc / B: menú';
const BODY_TOP = 158;
const BODY_BOTTOM = 858;
const VIEW_LABEL = { groups: 'GRUPOS', bracket: 'LLAVES', results: 'RESULTADOS', final: 'CAMPEÓN' };

// Cup hub: group tables, the knockout bracket, last results, next match and the final.
export default class CupScene extends Phaser.Scene {
  constructor() {
    super('Cup');
  }

  init(data) {
    this.view = data.view ?? null;
  }

  create() {
    makeTextures(this);
    wipeIn(this);
    playMenuMusic(this);
    this.cup = loadCup();
    if (!this.cup) {
      this.scene.start('NationSelect');
      return;
    }
    this.user = NATION_BY_ID[this.cup.userId];
    this.modal = null;

    this.add.image(0, 0, 'menuBg').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.62).setOrigin(0);
    this.content = this.add.container(0, 0);
    this.views = this.availableViews();
    if (!this.views.includes(this.view)) this.view = this.views[0];

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
        this.cycleView();
      } else if (event.code === 'Escape') goTo(this, 'Menu');
      else if (event.code === 'KeyN') this.openResetModal();
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);
  }

  // Which screens make sense right now, the most useful first.
  availableViews() {
    const c = this.cup;
    const views = [];
    if (isFinished(c)) views.push('final');
    if (c.stage === 'groups') views.push('groups');
    if (c.stage !== 'groups') views.push('bracket');
    if (c.groupResults.length || c.rounds.some((r) => r.some((m) => m.winner))) views.push('results');
    if (c.groups.length && c.stage !== 'groups') views.push('groups');
    return views;
  }

  // ---------- layout ----------

  drawHeader() {
    const c = this.cup;
    ribbon(this, CX, 56, 'COPA DE NACIONES', 400, 52).setAngle(-2);
    const extras = `${levelLabel(c.difficulty)}${c.hazards ? '  ·  POWER-UPS' : ''}`;
    const status = c.eliminated && !isFinished(c) ? 'QUEDASTE AFUERA' : stageLabel(c);
    uiText(this, CX, 116, `${status}  ·  ${this.user.short}  ·  ${extras}`, 19, PALETTE.yellow);
  }

  drawFooter() {
    const c = this.cup;
    const btnY = 1018;
    const m = nextUserMatch(c);

    if (m) {
      const home = NATION_BY_ID[m.home];
      const away = NATION_BY_ID[m.away];
      const rowY = 940;
      const label = m.knockout ? `PRÓXIMO PARTIDO · ${roundName(currentRound(c).length * 2)} · SI EMPATAN, GOL DE ORO` : 'PRÓXIMO PARTIDO';
      uiText(this, CX, 898, label, 17, PALETTE.yellow);
      this.add.image(CX - 268, rowY, flagTexture(this, home.id)).setScale(0.24);
      uiText(this, CX - 222, rowY, home.short, 22).setOrigin(0, 0.5);
      uiText(this, CX, rowY, 'VS', 22, PALETTE.yellow);
      uiText(this, CX + 222, rowY, away.short, 22).setOrigin(1, 0.5);
      this.add.image(CX + 268, rowY, flagTexture(this, away.id)).setScale(0.24);
    } else if (c.eliminated && !isFinished(c)) {
      uiText(this, CX, 920, 'La copa sigue sin vos: simulá el resto para ver quién sale campeón', 17, PALETTE.yellow);
    }

    // Footer buttons, left to right; arrows / joystick move the highlight.
    const items = [];
    this.viewBtn = button(this, 130, btnY, 200, 66, '', () => this.cycleView(), 19);
    items.push([this.viewBtn, () => this.cycleView()]);
    if (isFinished(c)) {
      const again = button(this, 500, btnY, 420, 66, 'NUEVA COPA', () => this.openResetModal(), 24);
      items.push([again, () => this.openResetModal()]);
    } else {
      const quit = button(this, 342, btnY, 200, 66, 'ABANDONAR', () => this.openResetModal(), 19);
      items.push([quit, () => this.openResetModal()]);
      const label = m ? 'JUGAR' : 'SIMULAR';
      const main = button(this, 610, btnY, 320, 66, label, () => this.mainAction(), 26);
      items.push([main, () => this.mainAction()]);
    }
    this.footer = items.map(([btn, action]) => ({ btn, action }));
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

  // The view button shows where it takes you next.
  updateViewButton() {
    const next = this.views[(this.views.indexOf(this.view) + 1) % this.views.length];
    this.viewBtn.container.list[1].setText(this.views.length > 1 ? VIEW_LABEL[next] : VIEW_LABEL[this.view]);
  }

  cycleView() {
    if (this.views.length < 2) return;
    sfx.select();
    this.view = this.views[(this.views.indexOf(this.view) + 1) % this.views.length];
    this.updateViewButton();
    this.render();
  }

  render() {
    this.content.removeAll(true);
    if (this.view === 'groups') this.renderGroups();
    else if (this.view === 'bracket') this.renderBracket();
    else if (this.view === 'results') this.renderResults();
    else this.renderFinal();
  }

  mainAction() {
    if (this.leaving) return;
    const c = this.cup;
    const m = nextUserMatch(c);
    if (!m) {
      // Knocked out: play out the rest of the cup.
      simulateToEnd(c);
      sfx.kickoff();
      goTo(this, 'Cup', { view: 'final' });
      return;
    }
    const home = NATION_BY_ID[m.home];
    const away = NATION_BY_ID[m.away];
    const kits = pickKits(home, away);
    sfx.kickoff();
    goTo(this, 'Game', {
      mode: 'league',
      match: {
        user: this.user,
        rival: m.userIsHome ? away : home,
        userKit: m.userIsHome ? kits.home : kits.away,
        rivalKit: m.userIsHome ? kits.away : kits.home,
        difficulty: c.difficulty,
        hazards: c.hazards,
        knockout: m.knockout,
        record: (userGoals, rivalGoals) => recordUserMatch(c, userGoals, rivalGoals),
        back: { scene: 'Cup', data: { view: 'results' } },
      },
    });
  }

  // ---------- views ----------

  add2(obj) {
    this.content.add(obj);
    return obj;
  }

  // All groups as mini tables. Green: through; yellow: third place that may still go
  // through as one of the best thirds (with 12 groups).
  renderGroups() {
    const c = this.cup;
    const groups = c.groups;
    const cols = groups.length === 12 ? 3 : 2;
    const rows = Math.ceil(groups.length / cols);
    const gap = 12;
    const w = (GAME_W - 60 - gap * (cols - 1)) / cols;
    const h = Math.min(190, (BODY_BOTTOM - BODY_TOP - gap * (rows - 1)) / rows);
    const thirdsGo = groups.length === 12;
    const big = cols === 2 && rows <= 2;
    const fontSize = big ? 20 : cols === 3 ? 13 : 16;

    groups.forEach((g, i) => {
      const x = 30 + (i % cols) * (w + gap);
      const y = BODY_TOP + Math.floor(i / cols) * (h + gap);
      const mine = g.teams.includes(c.userId);
      const bg = this.add2(this.add.graphics());
      bg.fillStyle(COLORS.ink, 0.92);
      bg.fillRoundedRect(x, y, w, h, 14);
      bg.lineStyle(mine ? 4 : 2, mine ? COLORS.yellow : COLORS.purple, 1);
      bg.strokeRoundedRect(x, y, w, h, 14);
      const headH = Math.min(30, h * 0.2);
      this.add2(this.add.text(x + 12, y + headH / 2 + 2, `GRUPO ${g.name}`, {
        fontFamily: FONTS.title, fontSize: `${Math.round(fontSize * 0.95)}px`, color: mine ? PALETTE.yellow : PALETTE.white,
      }).setOrigin(0, 0.5));
      this.add2(this.add.text(x + w - 12, y + headH / 2 + 2, 'PTS', {
        fontFamily: FONTS.ui, fontStyle: '900', fontSize: `${Math.round(fontSize * 0.8)}px`, color: PALETTE.white,
      }).setOrigin(1, 0.5));

      const rowH = (h - headH - 6) / 4;
      groupStandings(c, g).forEach((r, k) => {
        const ry = y + headH + 2 + rowH * k + rowH / 2;
        const nation = NATION_BY_ID[r.id];
        const through = k < 2 || (k === 2 && thirdsGo);
        if (through) {
          bg.fillStyle(k < 2 ? 0x3dd68c : COLORS.yellow, 0.9);
          bg.fillRect(x + 4, ry - rowH / 2 + 3, 5, rowH - 6);
        }
        const isUser = r.id === c.userId;
        const color = isUser ? PALETTE.yellow : PALETTE.white;
        this.add2(this.add.image(x + (big ? 36 : 30), ry, flagTexture(this, nation.id)).setScale(big ? 0.16 : 0.12));
        this.add2(this.add.text(x + (big ? 64 : 54), ry, nation.short, {
          fontFamily: FONTS.ui, fontStyle: '900', fontSize: `${fontSize}px`, color,
        }).setOrigin(0, 0.5));
        const dg = r.dg > 0 ? `+${r.dg}` : `${r.dg}`;
        this.add2(this.add.text(x + w - 52, ry, dg, {
          fontFamily: FONTS.ui, fontStyle: '900', fontSize: `${Math.round(fontSize * 0.8)}px`, color: '#bfb3ff',
        }).setOrigin(1, 0.5));
        this.add2(this.add.text(x + w - 12, ry, String(r.pts), {
          fontFamily: FONTS.title, fontSize: `${fontSize}px`, color,
        }).setOrigin(1, 0.5));
      });
    });
    const note = thirdsGo ? 'Pasan los 2 primeros de cada grupo y los 8 mejores terceros' : 'Pasan los 2 primeros de cada grupo';
    this.add2(uiText(this, CX, BODY_BOTTOM + 8, note, 15, '#bfb3ff'));
  }

  // The current knockout round (or the final, once the cup is over).
  renderBracket() {
    const c = this.cup;
    const round = currentRound(c);
    this.add2(uiText(this, CX, BODY_TOP + 8, roundName(round.length * 2), 24));
    this.matchList(round.map((m) => ({ a: m.a, b: m.b, ag: m.ag, bg: m.bg, pens: m.pens, winner: m.winner })), BODY_TOP + 44);
  }

  // Results of the last matchday (groups) or the last round played (knockout).
  renderResults() {
    const c = this.cup;
    const played = c.rounds.filter((r) => r.every((m) => m.winner));
    let title;
    let list;
    if (played.length && c.stage !== 'groups') {
      const r = played[played.length - 1];
      title = `RESULTADOS · ${roundName(r.length * 2)}`;
      list = r.map((m) => ({ a: m.a, b: m.b, ag: m.ag, bg: m.bg, pens: m.pens, winner: m.winner }));
    } else {
      const md = c.groupResults[c.groupResults.length - 1];
      title = `RESULTADOS · FECHA ${c.groupResults.length} DE GRUPOS`;
      list = md.map((r) => ({ a: r.home, b: r.away, ag: r.hg, bg: r.ag, group: r.group }));
    }
    this.add2(uiText(this, CX, BODY_TOP + 8, title, 22));
    this.matchList(list, BODY_TOP + 44);
  }

  // One row per match: kits, names and score; two columns when there are many.
  matchList(list, top) {
    const c = this.cup;
    const cols = list.length > 10 ? 2 : 1;
    const perCol = Math.ceil(list.length / cols);
    const rowH = Math.min(58, (BODY_BOTTOM - top) / perCol);
    const colW = (GAME_W - 60 - (cols - 1) * 12) / cols;
    const fontSize = cols === 2 ? 13 : 19;
    const g = this.add2(this.add.graphics());

    list.forEach((m, i) => {
      const col = Math.floor(i / perCol);
      const x = 30 + col * (colW + 12);
      const y = top + (i % perCol) * rowH;
      const isUser = m.a === c.userId || m.b === c.userId;
      g.fillStyle(isUser ? COLORS.yellow : COLORS.ink, isUser ? 1 : 0.88);
      g.fillRoundedRect(x, y + 2, colW, rowH - 4, 10);
      const color = isUser ? PALETTE.ink : PALETTE.white;
      const cy = y + rowH / 2;
      const mid = x + colW / 2;
      const style = (won) => ({
        fontFamily: FONTS.ui, fontStyle: '900', fontSize: `${fontSize}px`,
        color: m.winner && !won ? (isUser ? '#6b5a00' : '#8f86b8') : color,
      });
      const na = NATION_BY_ID[m.a];
      const nb = NATION_BY_ID[m.b];
      const flagScale = cols === 2 ? 0.11 : 0.16;
      const flagX = cols === 2 ? 24 : 34;
      this.add2(this.add.image(x + flagX, cy, flagTexture(this, na.id)).setScale(flagScale));
      this.add2(this.add.text(mid - (cols === 2 ? 34 : 56), cy, na.short, style(m.winner === m.a)).setOrigin(1, 0.5));
      const score = m.ag === null || m.ag === undefined ? 'vs' : `${m.ag} - ${m.bg}${m.pens ? '*' : ''}`;
      this.add2(this.add.text(mid, cy, score, {
        fontFamily: FONTS.title, fontSize: `${fontSize + 2}px`, color,
      }).setOrigin(0.5));
      this.add2(this.add.text(mid + (cols === 2 ? 34 : 56), cy, nb.short, style(m.winner === m.b)).setOrigin(0, 0.5));
      this.add2(this.add.image(x + colW - flagX, cy, flagTexture(this, nb.id)).setScale(flagScale));
    });
    if (list.some((m) => m.pens)) this.add2(uiText(this, CX, BODY_BOTTOM + 8, '* ganó por penales', 15, '#bfb3ff'));
  }

  renderFinal() {
    const c = this.cup;
    const champion = NATION_BY_ID[c.champion];
    const won = c.champion === c.userId;
    const burst = this.add2(this.add.image(CX, 390, 'burst').setScale(3.2).setAlpha(won ? 1 : 0.35));
    this.tweens.add({ targets: burst, angle: 360, duration: 16000, repeat: -1 });
    this.add2(this.add.image(CX, 390, 'trophy').setScale(0.95));
    this.add2(this.add.image(CX + 120, 455, flagTexture(this, champion.id)).setScale(0.42).setAngle(8));

    if (won) {
      this.add2(titleText(this, CX, 630, '¡CAMPEÓN!', 100).setAngle(-5));
      this.add2(ribbon(this, CX, 725, this.user.short, 380, 56).setAngle(-5));
      this.add2(uiText(this, CX, 805, '¡Ganaste la copa de naciones!', 26, PALETTE.yellow));
      sfx.win();
      this.time.addEvent({ delay: 700, repeat: 4, callback: () => this.confetti() });
    } else {
      this.add2(titleText(this, CX, 630, `CAMPEÓN: ${champion.short}`, champion.short.length > 9 ? 52 : 64).setAngle(-4));
      this.add2(ribbon(this, CX, 725, `${this.user.short}: ${this.userFinish()}`, 520, 56).setAngle(-4));
      this.add2(uiText(this, CX, 805, '¡La próxima es tuya!', 24, PALETTE.yellow));
    }
  }

  // How far the user got: "SUBCAMPEÓN", "SEMIFINAL", "FASE DE GRUPOS"...
  userFinish() {
    const c = this.cup;
    let last = null;
    for (const r of c.rounds) if (r.some((m) => m.a === c.userId || m.b === c.userId)) last = r;
    if (!last) return 'FASE DE GRUPOS';
    if (last.length === 1) return 'SUBCAMPEÓN';
    return roundName(last.length * 2);
  }

  confetti() {
    const colors = [COLORS.pink, COLORS.yellow, COLORS.cyan, COLORS.purple, 0xffffff];
    for (let i = 0; i < 40; i++) {
      const piece = this.add.rectangle(Phaser.Math.Between(0, GAME_W), -20, 9, 15, Phaser.Utils.Array.GetRandom(colors))
        .setStrokeStyle(2, COLORS.ink);
      this.tweens.add({
        targets: piece, y: GAME_H + 20, x: piece.x + Phaser.Math.Between(-120, 120),
        angle: Phaser.Math.Between(-720, 720), duration: Phaser.Math.Between(1800, 3000),
        onComplete: () => piece.destroy(),
      });
    }
  }

  // ---------- abandon / new cup ----------

  // Same confirmation as the league: "NO" preselected so a stray Enter can't wipe it.
  openResetModal() {
    if (this.modal || this.leaving) return;
    sfx.select();
    const finished = isFinished(this.cup);
    const title = finished ? '¿EMPEZAR OTRA COPA?' : '¿ABANDONAR LA COPA?';
    const detail = finished
      ? 'Elegís una selección nueva y las opciones del torneo.'
      : `Se pierde la copa de ${this.user.short}\ny empezás de nuevo eligiendo selección.`;
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
    const no = button(this, CX - 150, 655, 260, 64, 'NO', () => this.closeModal(), 22);
    const yes = button(this, CX + 150, 655, 260, 64, finished ? 'SÍ, NUEVA' : 'SÍ, ABANDONAR', () => this.confirmReset(), 22);
    this.modal = { sel: 0, buttons: [no, yes], parts: [dim, panel, heading, text, no.container, no.zone, yes.container, yes.zone] };
    for (const part of this.modal.parts) part.setDepth(100);
    this.selectModal(0);
  }

  selectModal(sel) {
    this.modal.sel = sel;
    this.modal.buttons.forEach((b, i) => b.setActive(i === sel));
  }

  modalKey(code) {
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(code)) {
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
    clearCup();
    sfx.kickoff();
    goTo(this, 'NationSelect');
  }
}
