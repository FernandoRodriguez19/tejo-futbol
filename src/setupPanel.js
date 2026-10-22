// "Antes de jugar" panel: option rows (difficulty, power-ups and any extra ones, like
// the cup's format and size) and a "¡A JUGAR!" button, drawn over the current screen.
// Up/down picks a row, left/right (or Enter / click) changes its value.
import { GAME_W, GAME_H, COLORS, PALETTE } from './config.js';
import { titleText, uiText, button, levelLabel } from './ui.js';
import { sfx } from './sound.js';

export const LEVELS = ['veryEasy', 'easy', 'medium', 'hard'].map((id) => ({ id, label: levelLabel(id) }));

export default class SetupPanel {
  //   icons: [{ texture, scale }] shown at the top (kits, a flag...)
  //   vs: write 'VS' between two icons (two kits facing off); defaults to true for two
  //   subtitle: line under the title
  //   extraRows: more { key, label, values: [{ id, label }], index } rows shown first
  //   difficulty: starting level id, or null to hide that row
  //   rememberBotLevel: store the chosen difficulty as the default for vs-bot matches
  //   onChange(row, rows): lets a row update the others
  //   onStart({ difficulty, hazards, ...extra keys }), onCancel(): Esc / B
  //   onClosed(): the panel is gone (started or cancelled)
  constructor(scene, {
    icons = [], vs = icons.length === 2, subtitle = '', extraRows = [], difficulty = null, rememberBotLevel = false,
    onChange, onStart, onCancel, onClosed,
  }) {
    this.scene = scene;
    this.opts = { rememberBotLevel, onChange, onStart, onCancel, onClosed };
    const cx = GAME_W / 2;
    const rows = [...extraRows];
    if (difficulty) {
      rows.push({ key: 'difficulty', label: 'DIFICULTAD', values: LEVELS, index: LEVELS.findIndex((l) => l.id === difficulty) });
    }
    // Remembers the last choice for the next match.
    rows.push({ key: 'hazards', label: 'POWER-UPS', values: [{ id: false, label: 'NO' }, { id: true, label: 'SÍ' }], index: scene.registry.get('hazards') ? 1 : 0 });
    this.rows = rows;

    const top = rows.length > 2 ? 230 : 290;
    const height = 240 + rows.length * 90 + 110;
    const dim = scene.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.78).setOrigin(0).setInteractive();
    const panel = scene.add.graphics();
    panel.fillStyle(COLORS.ink, 1);
    panel.fillRoundedRect(cx - 316, top + 6, 632, height, 26);
    panel.fillStyle(COLORS.purpleDark, 1);
    panel.fillRoundedRect(cx - 310, top, 620, height, 24);
    panel.lineStyle(5, COLORS.ink, 1);
    panel.strokeRoundedRect(cx - 310, top, 620, height, 24);
    const parts = [dim, panel];

    icons.forEach(({ texture, scale }, i) => {
      const x = cx + (i - (icons.length - 1) / 2) * 150;
      parts.push(scene.add.image(x, top + 62, texture).setScale(scale));
    });
    if (vs && icons.length === 2) parts.push(titleText(scene, cx, top + 62, 'VS', 34, PALETTE.yellow));
    parts.push(titleText(scene, cx, top + 140, 'ANTES DE JUGAR', 40));
    parts.push(uiText(scene, cx, top + 186, subtitle, 17, PALETTE.yellow));

    rows.forEach((row, i) => {
      row.btn = button(scene, cx, top + 250 + i * 90, 500, 66, '', () => {
        this.focus(i);
        this.change(1);
      }, 22);
      row.btn.zone.on('pointerover', () => this.focus(i));
      parts.push(row.btn.container, row.btn.zone);
    });
    const hazardsY = top + 250 + (rows.length - 1) * 90;
    parts.push(uiText(scene, cx, hazardsY + 48, 'Pegale con la pelota al hielo o al jabón para congelar o hacer patinar al rival', 15, PALETTE.cyan));

    this.play = button(scene, cx, top + height - 60, 340, 70, '¡A JUGAR!', () => this.start(), 30);
    this.play.zone.on('pointerover', () => this.focus(rows.length));
    parts.push(this.play.container, this.play.zone);
    parts.push(uiText(scene, cx, top + height + 34, '↑ ↓ elegir  ·  ← → cambiar  ·  Enter / A: aceptar  ·  Esc / B: volver', 15));

    this.parts = parts;
    for (const part of parts) part.setDepth(100);
    rows.forEach((row) => this.refresh(row));
    this.focused = null;
    this.focus(rows.length, true);
  }

  refresh(row) {
    row.btn.container.list[1].setText(`${row.label}:   ◀  ${row.values[row.index].label}  ▶`);
  }

  focus(index, silent = false) {
    if (index !== this.focused && !silent) sfx.select();
    this.focused = index;
    [...this.rows.map((r) => r.btn), this.play].forEach((b, i) => {
      b.setActive(i === index);
      b.container.setScale(i === index ? 1.05 : 1);
    });
  }

  change(step) {
    const row = this.rows[this.focused];
    if (!row) return;
    sfx.select();
    row.index = (row.index + step + row.values.length) % row.values.length;
    this.opts.onChange?.(row, this.rows);
    this.rows.forEach((r) => this.refresh(r));
  }

  // Keyboard / joystick (fake key codes from padMenu).
  key(code) {
    const n = this.rows.length + 1;
    if (code === 'ArrowUp' || code === 'KeyW') this.focus((this.focused + n - 1) % n);
    else if (code === 'ArrowDown' || code === 'KeyS') this.focus((this.focused + 1) % n);
    else if (code === 'ArrowLeft' || code === 'KeyA') this.change(-1);
    else if (code === 'ArrowRight' || code === 'KeyD') this.change(1);
    else if (code === 'Enter' || code === 'Space') {
      if (this.focused === this.rows.length) this.start();
      else this.change(1);
    } else if (code === 'Escape') this.close(true);
  }

  close(cancelled) {
    for (const part of this.parts) part.destroy();
    this.opts.onClosed?.();
    if (cancelled) {
      sfx.back();
      this.opts.onCancel?.();
    }
  }

  start() {
    if (this.scene.leaving) return;
    const settings = { difficulty: null, hazards: false };
    for (const row of this.rows) settings[row.key] = row.values[row.index].id;
    // Next time the screen starts with these same choices.
    this.scene.registry.set('hazards', settings.hazards);
    if (settings.difficulty && this.opts.rememberBotLevel) this.scene.registry.set('botLevel', settings.difficulty);
    sfx.confirm();
    this.opts.onStart(settings);
  }
}
