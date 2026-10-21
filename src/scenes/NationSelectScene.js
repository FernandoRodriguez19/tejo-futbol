import * as Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, PALETTE, FONTS } from '../config.js';
import { makeTextures, kitTexture } from '../art.js';
import { titleText, uiText, button, goTo, wipeIn, playMenuMusic, soundButton } from '../ui.js';
import { sfx, unlockAudio } from '../sound.js';
import { NATION_BY_ID, CONFEDERATIONS } from '../cup/nations.js';
import { flagTexture } from '../cup/flags.js';
import { newCup, saveCup, CUP_SIZES } from '../cup/cup.js';
import SetupPanel from '../setupPanel.js';
import { padMenu } from '../gamepads.js';

const CX = GAME_W / 2;
const CARD = { x: 50, y: 200, w: GAME_W - 100, h: 500 };
const TAB = { y: 150, w: 124, h: 44, gap: 8 };
const STRIP = { top: 790, thumbScale: 0.3, gap: 10, rowGap: 82 };
const CHOOSE_Y = 1000;
const CUP_FORMATS = [
  { id: 'groups', label: 'FASE DE GRUPOS' },
  { id: 'knockout', label: 'ELIMINACIÓN DIRECTA' },
];

// FIFA-style nation picker for the cup: confederation tabs on top, a big card with the
// selected nation (flag, kit, level, stars, World Cups) and a strip with the flags of
// that confederation. Left/right browse all 48 nations, up/down jump between
// confederations.
export default class NationSelectScene extends Phaser.Scene {
  constructor() {
    super('NationSelect');
  }

  init() {
    this.conf = 0;
    this.index = 0;
    this.setup = null;
  }

  create() {
    makeTextures(this);
    wipeIn(this);
    playMenuMusic(this);
    this.add.image(0, 0, 'menuBg').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.6).setOrigin(0);
    titleText(this, CX, 72, 'ELEGÍ TU SELECCIÓN', 50).setAngle(-3);
    soundButton(this, GAME_W - 48, 48);

    this.makeTabs();
    this.makeCard();
    this.stripLayer = this.add.container(0, 0);
    this.chooseBtn = button(this, CX, CHOOSE_Y, 460, 70, '', () => this.confirm(), 26);
    this.chooseBtn.setActive(true);
    uiText(this, CX, GAME_H - 44, '← → selección  ·  ↑ ↓ confederación  ·  Enter / A: elegir  ·  Esc / B: volver', 16);

    this.show(true);

    const onKey = (event) => {
      unlockAudio();
      if (this.setup) {
        this.setup.key(event.code);
        return;
      }
      const c = event.code;
      if (c === 'ArrowRight' || c === 'KeyD') this.step(1);
      else if (c === 'ArrowLeft' || c === 'KeyA') this.step(-1);
      else if (c === 'ArrowDown' || c === 'KeyS') this.jumpConf(1);
      else if (c === 'ArrowUp' || c === 'KeyW') this.jumpConf(-1);
      else if (c === 'Enter' || c === 'Space') this.confirm();
      else if (c === 'Escape') goTo(this, 'Menu');
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);
  }

  get nation() {
    return NATION_BY_ID[CONFEDERATIONS[this.conf].ids[this.index]];
  }

  // ---------- building ----------

  makeTabs() {
    const total = CONFEDERATIONS.length * TAB.w + (CONFEDERATIONS.length - 1) * TAB.gap;
    this.tabs = CONFEDERATIONS.map((conf, i) => {
      const x = CX - total / 2 + TAB.w / 2 + i * (TAB.w + TAB.gap);
      const bg = this.add.graphics();
      const label = this.add.text(0, 0, conf.label, {
        fontFamily: FONTS.title, fontSize: conf.label.length > 10 ? '11px' : '13px', color: PALETTE.white, align: 'center',
      }).setOrigin(0.5);
      const container = this.add.container(x, TAB.y, [bg, label]);
      const zone = this.add.zone(x, TAB.y, TAB.w, TAB.h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.setConf(i, 0));
      return { container, bg, label };
    });
  }

  makeCard() {
    const g = this.add.graphics();
    const { x, y, w, h } = CARD;
    g.fillStyle(COLORS.ink, 1);
    g.fillRoundedRect(x, y + 10, w, h, 30);
    g.fillStyle(COLORS.purpleDark, 1);
    g.fillRoundedRect(x, y, w, h, 30);
    // Diagonal light band, like a sports card.
    g.fillStyle(COLORS.purple, 1);
    g.fillPoints([
      { x: x + w * 0.38, y }, { x: x + w * 0.78, y },
      { x: x + w * 0.52, y: y + h }, { x: x + w * 0.12, y: y + h },
    ], true);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 14, y + 12, w - 28, 50, 20);
    g.lineStyle(6, COLORS.ink, 1);
    g.strokeRoundedRect(x, y, w, h, 30);

    // Pieces that change with the selection.
    this.flag = this.add.image(CX - 70, 340, flagTexture(this, 'argentina')).setAngle(-4);
    this.kit = this.add.image(CX + 225, 360, kitTexture(this, NATION_BY_ID.argentina.home, '10')).setScale(1.15);
    this.tweens.add({ targets: this.kit, y: 348, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // Level badge.
    const badge = this.add.graphics();
    badge.fillStyle(COLORS.ink, 1);
    badge.fillCircle(3, 5, 52);
    badge.fillStyle(COLORS.yellow, 1);
    badge.fillCircle(0, 0, 52);
    badge.lineStyle(5, COLORS.ink, 1);
    badge.strokeCircle(0, 0, 52);
    this.levelText = this.add.text(0, -6, '', { fontFamily: FONTS.title, fontSize: '40px', color: PALETTE.ink }).setOrigin(0.5);
    const levelLabel = this.add.text(0, 30, 'NIVEL', { fontFamily: FONTS.ui, fontStyle: '900', fontSize: '14px', color: PALETTE.ink }).setOrigin(0.5);
    this.badge = this.add.container(CARD.x + 78, CARD.y + 84, [badge, this.levelText, levelLabel]).setAngle(-8);

    this.nameText = titleText(this, CX, 520, '', 54);
    this.starsText = uiText(this, CX, 580, '', 30, PALETTE.yellow);
    this.cupsLayer = this.add.container(0, 0);

    // Big arrows on the sides of the card.
    for (const dir of [-1, 1]) {
      const ax = dir < 0 ? CARD.x - 4 : CARD.x + CARD.w + 4;
      const arrow = titleText(this, ax, CARD.y + CARD.h / 2, dir < 0 ? '◀' : '▶', 44, PALETTE.yellow);
      this.tweens.add({ targets: arrow, x: ax + dir * 6, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const zone = this.add.zone(ax, CARD.y + CARD.h / 2, 70, 120).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.step(dir));
    }
    const cardZone = this.add.zone(CX, CARD.y + CARD.h / 2, CARD.w - 140, CARD.h).setInteractive({ useHandCursor: true });
    cardZone.on('pointerdown', () => this.confirm());
  }

  // Flags of the current confederation, one or two rows.
  buildStrip() {
    this.stripLayer.removeAll(true);
    const ids = CONFEDERATIONS[this.conf].ids;
    const perRow = ids.length > 8 ? Math.ceil(ids.length / 2) : ids.length;
    const thumbW = 150 * STRIP.thumbScale;
    this.thumbs = ids.map((id, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, ids.length - row * perRow);
      const rowW = inRow * thumbW * 2 + (inRow - 1) * STRIP.gap;
      const x = CX - rowW / 2 + thumbW + (i % perRow) * (thumbW * 2 + STRIP.gap);
      const y = STRIP.top + row * STRIP.rowGap;
      const frame = this.add.graphics();
      const img = this.add.image(0, 0, flagTexture(this, id)).setScale(STRIP.thumbScale);
      const thumb = this.add.container(x, y, [frame, img]);
      const zone = this.add.zone(x, y, thumbW * 2, 64).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => (i === this.index ? this.confirm() : this.setConf(this.conf, i)));
      this.stripLayer.add([thumb, zone]);
      return { thumb, frame };
    });
    const counterY = STRIP.top + (ids.length > 8 ? STRIP.rowGap : 0) + 58;
    this.counter = uiText(this, CX, counterY, '', 16, '#bfb3ff');
    this.stripLayer.add(this.counter);
  }

  // ---------- selection ----------

  step(dir) {
    const ids = CONFEDERATIONS[this.conf].ids;
    let conf = this.conf;
    let index = this.index + dir;
    if (index >= ids.length) {
      conf = (conf + 1) % CONFEDERATIONS.length;
      index = 0;
    } else if (index < 0) {
      conf = (conf - 1 + CONFEDERATIONS.length) % CONFEDERATIONS.length;
      index = CONFEDERATIONS[conf].ids.length - 1;
    }
    this.setConf(conf, index);
  }

  jumpConf(dir) {
    const conf = (this.conf + dir + CONFEDERATIONS.length) % CONFEDERATIONS.length;
    this.setConf(conf, Math.min(this.index, CONFEDERATIONS[conf].ids.length - 1));
  }

  setConf(conf, index) {
    if (conf === this.conf && index === this.index) return;
    const confChanged = conf !== this.conf;
    this.conf = conf;
    this.index = index;
    sfx.select();
    this.show(confChanged);
  }

  show(rebuildStrip) {
    const n = this.nation;
    if (rebuildStrip) this.buildStrip();

    this.tabs.forEach((tab, i) => {
      const on = i === this.conf;
      tab.bg.clear();
      tab.bg.fillStyle(COLORS.ink, 1);
      tab.bg.fillRoundedRect(-TAB.w / 2, -TAB.h / 2 + 4, TAB.w, TAB.h, 14);
      tab.bg.fillStyle(on ? COLORS.yellow : COLORS.purple, 1);
      tab.bg.fillRoundedRect(-TAB.w / 2, -TAB.h / 2, TAB.w, TAB.h, 14);
      tab.bg.lineStyle(4, COLORS.ink, 1);
      tab.bg.strokeRoundedRect(-TAB.w / 2, -TAB.h / 2, TAB.w, TAB.h, 14);
      tab.label.setColor(on ? PALETTE.ink : PALETTE.white);
      tab.container.setScale(on ? 1.06 : 1);
    });

    this.thumbs.forEach(({ thumb, frame }, i) => {
      const on = i === this.index;
      frame.clear();
      if (on) {
        frame.fillStyle(COLORS.yellow, 1);
        frame.fillRoundedRect(-52, -37, 104, 74, 14);
        frame.lineStyle(4, COLORS.ink, 1);
        frame.strokeRoundedRect(-52, -37, 104, 74, 14);
      }
      this.tweens.killTweensOf(thumb);
      this.tweens.add({ targets: thumb, scale: on ? 1.15 : 0.92, duration: 150, ease: 'Back.Out' });
      thumb.setDepth(on ? 2 : 1).setAlpha(on ? 1 : 0.8);
    });
    this.counter.setText(`${CONFEDERATIONS[this.conf].label}  ·  ${this.index + 1} / ${CONFEDERATIONS[this.conf].ids.length}`);

    // Card.
    this.flag.setTexture(flagTexture(this, n.id));
    this.kit.setTexture(kitTexture(this, n.home, '10'));
    const name = n.name.toUpperCase();
    this.nameText.setText(name).setFontSize(name.length > 12 ? 44 : 54);
    this.chooseBtn.container.list[1].setText(`ELEGIR ${n.short}`);
    const stars = Math.max(1, Math.round(n.strength * 5));
    this.starsText.setText('★'.repeat(stars) + '☆'.repeat(5 - stars));
    this.levelText.setText(String(Math.round(55 + n.strength * 42)));

    this.cupsLayer.removeAll(true);
    if (n.titles) {
      const label = uiText(this, CX - 30 * n.titles, 640, 'COPAS DEL MUNDO', 18);
      this.cupsLayer.add(label);
      for (let i = 0; i < n.titles; i++) {
        this.cupsLayer.add(this.add.image(label.x + label.width / 2 + 34 + i * 40, 638, 'trophy').setScale(0.14));
      }
    } else {
      this.cupsLayer.add(uiText(this, CX, 640, '¡A BUSCAR SU PRIMERA COPA DEL MUNDO!', 18, '#bfb3ff'));
    }

    // Little pop when the nation changes.
    this.tweens.killTweensOf([this.flag, this.badge]);
    this.flag.setScale(0.85);
    this.tweens.add({ targets: this.flag, scale: 1, duration: 260, ease: 'Back.Out' });
    this.badge.setScale(0.6);
    this.tweens.add({ targets: this.badge, scale: 1, duration: 300, ease: 'Back.Out' });
  }

  // ---------- cup options ----------

  confirm() {
    if (this.leaving || this.setup) return;
    unlockAudio();
    sfx.kickoff();
    const nation = this.nation;
    const sizeValues = (format) => CUP_SIZES[format].map((n) => ({
      id: n,
      label: format === 'groups' ? `${n} (${n / 4} GRUPOS)` : `${n} EQUIPOS`,
    }));
    const formatRow = { key: 'format', label: 'FORMATO', values: CUP_FORMATS, index: 0 };
    const sizeRow = { key: 'size', label: 'EQUIPOS', values: sizeValues('groups'), index: 0 };
    this.setup = new SetupPanel(this, {
      icons: [
        { texture: flagTexture(this, nation.id), scale: 0.42 },
        { texture: kitTexture(this, nation.home, '10'), scale: 0.55 },
      ],
      vs: false,
      subtitle: `Copa con ${nation.short}  ·  si achicás la copa juegan los mejores`,
      extraRows: [formatRow, sizeRow],
      difficulty: 'medium',
      // Changing the format swaps the size options, keeping the closest size.
      onChange: (row) => {
        if (row !== formatRow) return;
        const current = sizeRow.values[sizeRow.index].id;
        sizeRow.values = sizeValues(CUP_FORMATS[formatRow.index].id);
        const sizes = sizeRow.values.map((v) => v.id);
        const closest = sizes.reduce((best, s) => (Math.abs(s - current) < Math.abs(best - current) ? s : best), sizes[0]);
        sizeRow.index = sizes.indexOf(closest);
      },
      onStart: ({ format, size, difficulty, hazards }) => {
        saveCup(newCup(nation.id, { format, size, difficulty, hazards }));
        goTo(this, 'Cup', {});
      },
      onClosed: () => { this.setup = null; },
    });
  }
}
