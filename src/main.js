import * as Phaser from 'phaser';
import { GAME_W, GAME_H } from './config.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import TeamSelectScene from './scenes/TeamSelectScene.js';
import LeagueScene from './scenes/LeagueScene.js';
import OptionsScene from './scenes/OptionsScene.js';
import SoundScene from './scenes/SoundScene.js';
import CupScene from './scenes/CupScene.js';
import NationSelectScene from './scenes/NationSelectScene.js';

// Phaser draws text and textures onto canvases, so the web fonts must be ready first.
// If they can't load (offline), start anyway with the fallback fonts.
async function loadFonts() {
  const fonts = Promise.all([
    document.fonts.load('40px "Bungee"'),
    document.fonts.load('700 20px "Rubik"'),
    document.fonts.load('900 20px "Rubik"'),
  ]);
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  await Promise.race([fonts, timeout]).catch(() => {});
}

loadFonts().then(startGame);

function startGame() {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: '#1d1240',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // The options and sound panels go last so they're drawn over whichever screen opened
    // them (the sound panel can open from the options one).
    scene: [MenuScene, GameScene, TeamSelectScene, LeagueScene, CupScene, NationSelectScene, OptionsScene, SoundScene],
  });

  // Handy for poking at the game from the browser console while developing.
  if (import.meta.env.DEV) window.game = game;
}
