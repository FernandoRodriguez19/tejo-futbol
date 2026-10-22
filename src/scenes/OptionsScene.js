import * as Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.js';
import {
  titleText, uiText, button, iconButton, controlsPanel, openSoundPanel, drawGamepadIcon, drawSpeakerIcon,
} from '../ui.js';
import {
  sfx, unlockAudio, getChannel, isMuted, iconLevel, toggleMute, onVolumeChange,
} from '../sound.js';
import { padMenu } from '../gamepads.js';

const CX = GAME_W / 2;
const CARD = { x: 110, y: 320, w: GAME_W - 220, h: 480 };

// "OPCIONES", opened over any screen with openOptions() (ui.js, the gear button or O):
// CONTROLES opens the controls panel on top of this one, SONIDO opens the sound panel
// (SoundScene). The screen below stays paused until this closes.
export default class OptionsScene extends Phaser.Scene {
  constructor() {
    super('Options');
  }

  init(data) {
    this.from = data.from;
    this.focus = 0;
    this.controls = null;
    this.closing = false;
  }

  create() {
    const dim = this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.75).setOrigin(0).setInteractive();
    dim.on('pointerdown', () => this.close());

    const g = this.add.graphics();
    const { x, y, w, h } = CARD;
    g.fillStyle(COLORS.ink, 1);
    g.fillRoundedRect(x - 6, y + 8, w + 12, h, 30);
    g.fillStyle(COLORS.purpleDark, 1);
    g.fillRoundedRect(x, y, w, h, 28);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 14, y + 12, w - 28, 50, 20);
    g.lineStyle(6, COLORS.ink, 1);
    g.strokeRoundedRect(x, y, w, h, 28);
    // Clicks on the card land here instead of on the dim layer, which closes it.
    this.add.zone(CX, y + h / 2, w, h).setInteractive();
    titleText(this, CX, y + 66, 'OPCIONES', 58).setAngle(-3);

    const controls = iconButton(this, CX, y + 175, w - 90, 92, {
      title: 'CONTROLES', sub: 'Teclado y joystick', drawIcon: drawGamepadIcon,
    }, () => this.press(0));
    const sound = iconButton(this, CX, y + 285, w - 90, 92, {
      title: 'SONIDO', sub: this.soundSummary(), drawIcon: (icon) => drawSpeakerIcon(icon, iconLevel()),
    }, () => this.press(1));
    const done = button(this, CX, y + 388, 240, 62, '¡LISTO!', () => this.press(2), 26);
    this.items = [controls, sound, done];
    this.items.forEach((item, i) => item.zone.on('pointerover', () => this.setFocus(i)));
    uiText(this, CX, y + h - 26, '↑ ↓ elegir  ·  Enter / A: aceptar  ·  M: silenciar  ·  Esc: cerrar', 14, '#bfb3ff');

    // The sound row shows the current levels, also after changing them in the sound panel.
    const stop = onVolumeChange(() => {
      sound.icon.clear();
      drawSpeakerIcon(sound.icon, iconLevel());
      sound.setLabel('SONIDO', this.soundSummary());
    });
    this.events.once('shutdown', stop);

    const onKey = (event) => {
      unlockAudio();
      const c = event.code;
      if (this.controls) {
        this.controls.key(c);
        return;
      }
      if (c === 'ArrowUp' || c === 'KeyW') this.setFocus((this.focus + 2) % 3);
      else if (c === 'ArrowDown' || c === 'KeyS') this.setFocus((this.focus + 1) % 3);
      else if (c === 'Enter' || c === 'Space') this.press(this.focus);
      else if (c === 'KeyM') {
        toggleMute();
        sfx.select();
      } else if (c === 'Escape' || c === 'KeyO') this.close();
    };
    this.input.keyboard.on('keydown', onKey);
    padMenu(this, onKey);

    this.setFocus(0, true);
  }

  soundSummary() {
    if (isMuted()) return 'Todo silenciado (M)';
    const pct = (ch) => `${Math.round(getChannel(ch) * 100)} %`;
    return `Música ${pct('music')}  ·  Hinchada ${pct('crowd')}  ·  Efectos ${pct('sfx')}`;
  }

  setFocus(index, silent = false) {
    if (index !== this.focus && !silent) sfx.select();
    this.focus = index;
    this.items.forEach((item, i) => item.setActive(i === index));
  }

  press(index) {
    if (this.controls || this.closing) return;
    this.setFocus(index, true);
    if (index === 0) this.controls = controlsPanel(this, () => { this.controls = null; });
    else if (index === 1) openSoundPanel(this);
    else this.close();
  }

  close() {
    if (this.closing || this.controls) return;
    this.closing = true;
    sfx.back();
    this.scene.resume(this.from);
    this.scene.stop();
  }
}
