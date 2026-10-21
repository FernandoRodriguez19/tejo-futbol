import * as Phaser from 'phaser';
import {
  GAME_W, GAME_H, FIELD, CORNER_R, MID_Y, CENTER_X, MOUTH_L, MOUTH_R, POST_R,
  PLAYER_R, PLAYER_SPEED, KICKOFF_OFFSET, BALL_R, BALL, KICK, WIN_GOALS, GOAL_PAUSE,
  KICKOFF_DELAY, COLORS, PALETTE, FONTS, BOT_LEVELS, DASH, HAZARDS,
} from '../config.js';
import { makeTextures, kitTexture, SPRITE_SCALE } from '../art.js';
import { titleText, uiText, ribbon, goTo, wipeIn, soundButton } from '../ui.js';
import { sfx, unlockAudio } from '../sound.js';
import {
  playChant, stopChant, pauseChant, resumeChant, stopLoop, pauseLoops, resumeLoops, playSound,
  startMatchMusic, changeMatchTrack, stopMatchMusic,
} from '../music.js';
import Bot from '../game/Bot.js';
import { pollPads, pad, padToast, BTN } from '../gamepads.js';
import Particles from '../game/Particles.js';
import Hazards from '../game/Hazards.js';
import Replay from '../game/Replay.js';
import {
  floatText, drawEyes, drawNetRipple, makeFans, drawCrowd, headingIntoGoal,
} from '../game/juice.js';
import { MATCH_SECONDS, botConfigFor } from '../league/league.js';
import { mainColor, pickKits, TEAM_BY_ID } from '../league/teams.js';

const POSTS = [
  { x: MOUTH_L, y: FIELD.top }, { x: MOUTH_R, y: FIELD.top },
  { x: MOUTH_L, y: FIELD.bottom }, { x: MOUTH_R, y: FIELD.bottom },
];
const TRAIL_LEN = 12;
const CONFETTI = [COLORS.pink, COLORS.yellow, COLORS.cyan, COLORS.purple, 0xffffff];
const FIRE_ON = 0.72; // speed ratio where the ball catches fire...
const FIRE_OFF = 0.55; // ...and where it goes out
const FIRE_COLORS = [0xfff3a0, 0xffd23f, 0xff8a3d, 0xff4757];
const SLOWMO = 0.3;
const REPLAY_CLIP = 1600; // ms of play shown in the replay
const REPLAY_SPEED = 0.6;
const COUNTDOWN_STEP = 550;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  // data.mode: 'pvp' | 'bot' | 'league'. Tournament matches (league and cup, mode
  // 'league') also get data.match = {
  //   user, rival, userKit, rivalKit,   teams (clubs or nations) and their kits
  //   difficulty, hazards,              tournament settings
  //   knockout,                         true: a draw at full time goes to golden goal
  //   record(userGoals, rivalGoals),    saves the result
  //   back: { scene, data },            where "continuar" goes afterwards
  // }. Friendlies get data.teams = { p1, p2 } (club ids) to wear those teams' kits.
  init(data) {
    this.mode = data.mode ?? 'pvp';
    this.level = data.level ?? 'medium';
    this.match = data.match ?? null;
    this.teams = data.teams ?? null;
    // Ice & soap hazards: a tournament setting, or chosen before each friendly.
    this.hazardsOn = this.match ? !!this.match.hazards : !!data.hazards;
    this.goldenGoal = false;
  }

  // Kits and names for both sides: league teams, the teams picked for a friendly, or
  // plain blue/red.
  sides() {
    const m = this.match;
    if (m) return { p1Kit: m.userKit, p2Kit: m.rivalKit, p1Name: m.user.short, p2Name: m.rival.short };
    if (this.teams) {
      const t1 = TEAM_BY_ID[this.teams.p1];
      const t2 = TEAM_BY_ID[this.teams.p2];
      const kits = pickKits(t1, t2);
      const botTag = this.mode === 'bot' ? ` (${BOT_LEVELS[this.level].label})` : '';
      return { p1Kit: kits.home, p2Kit: kits.away, p1Name: t1.short, p2Name: `${t2.short}${botTag}` };
    }
    return {
      p1Kit: { pattern: 'solid', colors: [PALETTE.p1] },
      p2Kit: { pattern: 'solid', colors: [PALETTE.p2] },
      p1Name: 'Jugador 1',
      p2Name: this.mode === 'bot' ? `Bot ${BOT_LEVELS[this.level].label}` : 'Jugador 2',
    };
  }

  create() {
    makeTextures(this);
    const m = this.match;
    this.setupCameras();
    wipeIn(this);

    this.add.image(0, 0, 'field').setOrigin(0);

    this.keys = this.input.keyboard.addKeys({
      w: 'W', a: 'A', s: 'S', d: 'D', space: 'SPACE',
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', enter: 'ENTER',
      esc: 'ESC', r: 'R', q: 'Q',
    });

    // World layers, bottom to top.
    this.netGfx = this.add.graphics().setDepth(0.5);
    this.crowdGfx = this.add.graphics().setDepth(0.5);
    this.shadows = this.add.graphics().setDepth(1);
    this.dust = new Particles(this, 1.5);
    this.trailGfx = this.add.graphics().setDepth(2);
    // Normal blending: additive fire washes out to white over the bright grass.
    this.fire = new Particles(this, 2.5);
    this.rings = this.add.graphics().setDepth(3);

    // p1 defends the bottom goal, p2 the top one. Kits have no number: the eyes go there.
    const { p1Kit, p2Kit, p1Name, p2Name } = this.sides();
    this.p1Kit = p1Kit;
    this.p2Kit = p2Kit;
    this.p1Name = p1Name;
    this.p2Name = p2Name;
    this.p1 = this.makePlayer(kitTexture(this, p1Kit, ''), 'bottom', p1Kit);
    this.p2 = this.makePlayer(kitTexture(this, p2Kit, ''), 'top', p2Kit);
    this.eyesGfx = this.add.graphics().setDepth(4.5);

    // The ball image sits in a container: the container stretches along the velocity,
    // the image inside spins.
    this.ball = { x: CENTER_X, y: MID_Y, vx: 0, vy: 0 };
    this.ballBody = this.add.image(0, 0, 'ball').setScale(SPRITE_SCALE);
    this.ball.sprite = this.add.container(CENTER_X, MID_Y, [this.ballBody]).setDepth(5);
    this.ballSpin = 0;
    this.ballSquash = 0;
    this.grass = new Particles(this, 5.5);
    this.trail = [];

    if (m) this.bot = new Bot(this.p2, this.ball, this.p1, botConfigFor(m.rival.strength, m.difficulty));
    else this.bot = this.mode === 'bot' ? new Bot(this.p2, this.ball, this.p1, this.level) : null;

    this.score = { p1: 0, p2: 0 };
    this.timeLeft = m ? MATCH_SECONDS * 1000 : null;
    this.paused = false;
    this.asUI(() => this.makeHud());
    // Sound button in the bottom corner, above the pause screen so it works there too.
    this.asUI(() => soundButton(this, GAME_W - 40, GAME_H - 38, 0.85).setDepth(25));

    // Juice state.
    this.fans = makeFans();
    this.net = null;
    this.celebration = null;
    this.replay = new Replay(3000);
    this.hitstop = 0;
    this.slowmoUntil = 0;
    this.cooldowns = {};
    this.rally = 0;
    this.onFire = false;
    this.camPunch = null;
    this.cam = { zoom: 1, x: CENTER_X, y: GAME_H / 2 };
    this.playTime = 0; // ms of actual play (stops for goals, replays and pauses)
    this.hazards = this.hazardsOn ? new Hazards(this) : null;
    this.statusGfx = this.add.graphics().setDepth(4.4); // ice cubes over frozen players

    // Dash keys: left Shift for player 1, right Shift for player 2 (either one for
    // player 1 against the bot). Joysticks use R1, read in update().
    this.dashQueued = new Set();
    this.input.keyboard.on('keydown', (event) => {
      if (event.code === 'ShiftLeft') this.dashQueued.add(this.p1);
      else if (event.code === 'ShiftRight') this.dashQueued.add(this.bot ? this.p1 : this.p2);
    });

    this.input.on('pointerdown', unlockAudio);
    this.kickoff(Math.random() < 0.5 ? this.p1 : this.p2, true);

    // The menu music stops and the opening chant plays; when it's over the background
    // music rotation starts (and changes track on every goal). More chants when someone
    // falls 2 or 4+ goals behind.
    stopLoop('menu');
    this.chant = { side: null, rank: 0 };
    this.musicOver = false;
    playChant('start', () => {
      if (!this.musicOver && this.state !== 'over' && this.sys.isActive()) startMatchMusic();
    });
    this.events.once('shutdown', () => {
      stopChant();
      stopMatchMusic();
    });
  }

  // ---------- setup ----------

  // Two cameras: the main one zooms and follows the play; the UI camera keeps the
  // scoreboard and banners still. Every new object goes to the world unless it's
  // created inside asUI().
  setupCameras() {
    const main = this.cameras.main;
    main.setBounds(0, 0, GAME_W, GAME_H);
    this.uiCam = this.cameras.add(0, 0, GAME_W, GAME_H);
    this.creatingUI = false;
    const route = (obj) => (this.creatingUI ? main : this.uiCam).ignore(obj);
    this.events.on('addedtoscene', route);
    this.events.once('shutdown', () => this.events.off('addedtoscene', route));
  }

  asUI(fn) {
    const prev = this.creatingUI;
    this.creatingUI = true;
    try {
      return fn();
    } finally {
      this.creatingUI = prev;
    }
  }

  makePlayer(texture, side, kit) {
    const p = {
      side,
      color: parseInt(mainColor(kit).slice(1), 16),
      x: CENTER_X,
      y: this.startY(side),
      vx: 0, vy: 0,
      armedUntil: 0,
      lastKick: -Infinity,
      kickHeld: false,
      squash: 0,
      dustTimer: 0,
      mood: 'normal',
      moodUntil: 0,
      dash: 0, // 0..1 charge
      dashLeft: 0, // ms of dash still running
      dashDir: { x: 0, y: 0 },
      frozenUntil: 0, // play time until which the player is frozen (ice)
      slipUntil: 0, // play time until which the player is slippery (soap)
      mvx: 0, mvy: 0, // actual velocity while slipping
    };
    p.sprite = this.add.image(p.x, p.y, texture).setScale(SPRITE_SCALE).setDepth(4);
    return p;
  }

  startY(side) {
    return side === 'bottom' ? FIELD.bottom - KICKOFF_OFFSET : FIELD.top + KICKOFF_OFFSET;
  }

  makeHud() {
    const cy = 50;
    const w = 520;
    const h = 66;
    const m = this.match;
    const hex = (c) => parseInt(c.slice(1), 16);
    const g = this.add.graphics().setDepth(8);
    g.fillStyle(COLORS.ink, 1);
    g.fillRoundedRect(CENTER_X - w / 2 - 6, cy - h / 2 - 6, w + 12, h + 12, 22);
    g.fillStyle(hex(mainColor(this.p1Kit)), 1);
    g.fillRoundedRect(CENTER_X - w / 2, cy - h / 2, w / 2 - 2, h, { tl: 16, bl: 16, tr: 4, br: 4 });
    g.fillStyle(hex(mainColor(this.p2Kit)), 1);
    g.fillRoundedRect(CENTER_X + 2, cy - h / 2, w / 2 - 2, h, { tl: 4, bl: 4, tr: 16, br: 16 });
    g.fillStyle(0xffffff, 0.2);
    g.fillRect(CENTER_X - w / 2 + 10, cy - h / 2 + 4, w - 20, 12);

    const nameStyle = { fontFamily: FONTS.ui, fontStyle: '900', fontSize: '17px', color: PALETTE.white, stroke: PALETTE.ink, strokeThickness: 4 };
    this.add.text(CENTER_X - w / 2 + 18, cy, this.p1Name.toUpperCase(), nameStyle).setOrigin(0, 0.5).setDepth(9);
    this.add.text(CENTER_X + w / 2 - 18, cy, this.p2Name.toUpperCase(), nameStyle).setOrigin(1, 0.5).setDepth(9);
    this.p1ScoreText = titleText(this, CENTER_X - 34, cy, '0', 40).setDepth(9);
    this.p2ScoreText = titleText(this, CENTER_X + 34, cy, '0', 40).setDepth(9);

    // Speed tag on the right, "Esc" hint on the left.
    const tagX = GAME_W - 74;
    g.fillStyle(COLORS.ink, 1);
    g.fillRoundedRect(tagX - 58, cy - 26, 116, 52, 16);
    g.fillStyle(COLORS.yellow, 1);
    g.fillRoundedRect(tagX - 53, cy - 21, 106, 42, 12);
    this.add.text(tagX, cy - 9, 'VELOCIDAD', { fontFamily: FONTS.ui, fontStyle: '900', fontSize: '11px', color: PALETTE.ink })
      .setOrigin(0.5).setDepth(9);
    this.speedText = this.add.text(tagX, cy + 8, 'x1.0', { fontFamily: FONTS.title, fontSize: '20px', color: PALETTE.ink })
      .setOrigin(0.5).setDepth(9);
    if (m) {
      // Match clock instead of the Esc hint.
      g.fillStyle(COLORS.ink, 1);
      g.fillRoundedRect(16, cy - 26, 116, 52, 16);
      this.clockText = this.add.text(74, cy, '', { fontFamily: FONTS.title, fontSize: '28px', color: PALETTE.white })
        .setOrigin(0.5).setDepth(9);
      this.updateClock();
    } else {
      uiText(this, 74, cy, 'ESC / START\nPAUSA', 14).setDepth(9).setLineSpacing(-4);
    }

    // Dash bars under each half of the scoreboard, redrawn every frame.
    this.dashBars = this.add.graphics().setDepth(9);
    uiText(this, CENTER_X, cy + h / 2 + 17, 'DASH', 12, PALETTE.yellow).setDepth(10);
    this.dashBarGeom = { y: cy + h / 2 + 10, w: w / 2 - 44, left: CENTER_X - w / 2 + 12, right: CENTER_X + 32 };

    this.updateHud();
  }

  drawDashBars(now) {
    const g = this.dashBars;
    const { y, w, left, right } = this.dashBarGeom;
    g.clear();
    for (const [p, x] of [[this.p1, left], [this.p2, right]]) {
      const full = p.dash >= 1;
      g.fillStyle(COLORS.ink, 1);
      g.fillRoundedRect(x - 4, y - 4, w + 8, 22, 11);
      if (p.dash > 0) {
        const pulse = full ? 0.75 + 0.25 * Math.sin(now / 110) : 0.85;
        g.fillStyle(full ? COLORS.yellow : 0xffffff, pulse);
        g.fillRoundedRect(x, y, Math.max(14, w * p.dash), 14, 7);
      }
    }
  }

  updateClock() {
    const secs = Math.ceil(Math.max(0, this.timeLeft) / 1000);
    this.clockText.setText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    this.clockText.setColor(secs <= 10 ? PALETTE.p2 : PALETTE.white);
  }

  updateHud() {
    this.p1ScoreText.setText(String(this.score.p1));
    this.p2ScoreText.setText(String(this.score.p2));
  }

  // The number that just changed jumps and flashes yellow.
  popScore(key) {
    const t = key === 'p1' ? this.p1ScoreText : this.p2ScoreText;
    this.tweens.killTweensOf(t);
    t.setScale(2).setColor(PALETTE.yellow);
    this.tweens.add({ targets: t, scale: 1, duration: 500, ease: 'Back.Out' });
    this.time.delayedCall(600, () => t.setColor(PALETTE.titleFill));
  }

  // ---------- flow ----------

  // Resets the field and launches the ball from the centre toward `receiver`.
  // The first kickoff of a match gets a full "3, 2, 1, ¡YA!" countdown.
  kickoff(receiver, countdown = false) {
    this.state = 'kickoff';
    for (const p of [this.p1, this.p2]) {
      p.x = CENTER_X;
      p.y = this.startY(p.side);
      p.vx = p.vy = 0;
      p.mood = 'normal';
      p.moodUntil = 0;
      p.dashLeft = 0;
      p.frozenUntil = p.slipUntil = 0;
      p.mvx = p.mvy = 0;
    }
    this.hazards?.reset(this.playTime);
    // lastTouch: the player who last kicked or touched the ball (power-ups go to them).
    Object.assign(this.ball, { x: CENTER_X, y: MID_Y, vx: 0, vy: 0, lastTouch: null });
    this.trail.length = 0;
    this.replay.clear();
    this.rally = 0;
    this.onFire = false;
    this.camPunch = null;

    const numbers = countdown ? ['3', '2', '1'] : [];
    numbers.forEach((label, i) => this.time.delayedCall(i * COUNTDOWN_STEP, () => {
      if (this.state !== 'kickoff') return;
      this.countText(label, PALETTE.titleFill);
      sfx.countdown();
    }));
    const goAt = countdown ? numbers.length * COUNTDOWN_STEP : KICKOFF_DELAY;
    this.time.delayedCall(goAt, () => {
      if (this.state !== 'kickoff') return;
      this.countText('¡YA!', PALETTE.yellow);
      sfx.go();
      const angle = Phaser.Math.DegToRad(Phaser.Math.Between(-35, 35));
      const dirY = receiver.side === 'bottom' ? 1 : -1;
      this.ball.vx = Math.sin(angle) * BALL.baseSpeed;
      this.ball.vy = Math.cos(angle) * BALL.baseSpeed * dirY;
      this.state = 'playing';
    });
  }

  countText(label, color) {
    const t = this.asUI(() => titleText(this, CENTER_X, MID_Y - 150, label, 120, color).setDepth(12).setScale(2).setAlpha(0));
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, scale: 0.8, delay: 380, duration: 180, onComplete: () => t.destroy() });
  }

  goal(scorer) {
    this.state = 'goal';
    const key = scorer === this.p1 ? 'p1' : 'p2';
    const conceder = scorer === this.p1 ? this.p2 : this.p1;
    this.score[key]++;
    this.updateHud();
    this.popScore(key);

    const now = this.time.now;
    const goalY = scorer === this.p1 ? FIELD.top : FIELD.bottom;
    this.net = { top: scorer === this.p1, x: Phaser.Math.Clamp(this.ball.x, MOUTH_L + 15, MOUTH_R - 15), t0: now };
    this.celebration = { t0: now };
    this.camPunch = { x: this.ball.x, y: goalY, until: now + GOAL_PAUSE };
    scorer.mood = 'happy';
    conceder.mood = 'dizzy';
    scorer.moodUntil = conceder.moodUntil = Infinity;
    this.confetti(this.ball.x, goalY, scorer === this.p1 ? 1 : -1);
    this.grass.emit(this.ball.x, goalY, {
      count: 18, speed: [120, 320], spread: 360, life: [400, 800], size: [3, 6],
      colors: [0x6fbf2a, 0x9be33b, 0x4f9a1f], shape: 'rect', drag: 3,
    });
    playSound('goal');

    this.ball.vx = this.ball.vy = 0;
    this.trail.length = 0;
    this.trailGfx.clear();
    this.speedText.setText('x1.0');
    this.cameras.main.shake(250, 0.01);
    this.cameras.main.flash(150, 255, 255, 255);

    const name = scorer === this.p1 ? this.p1Name : this.p2Name;
    // Tournament matches are played against the clock instead of to WIN_GOALS; a golden
    // goal ends the match.
    const won = !this.match && (this.score.p1 >= WIN_GOALS || this.score.p2 >= WIN_GOALS);
    const golden = this.goldenGoal;

    sfx.goal();
    if (won || golden) {
      this.musicOver = true;
      stopChant();
    } else {
      changeMatchTrack();
      this.updateChant();
    }
    this.showBanner(golden ? '¡GOL DE ORO!' : '¡GOLAZO!', name.toUpperCase(), true);

    this.time.delayedCall(GOAL_PAUSE, () => this.startReplay(() => {
      if (won) this.showWin(scorer);
      else if (golden) this.endLeagueMatch();
      else this.kickoff(conceder);
    }));
  }

  // Knockout match tied at full time: play on until someone scores.
  startGoldenGoal() {
    this.goldenGoal = true;
    this.timeLeft = 0;
    this.clockText.setText('ORO').setColor(PALETTE.yellow);
    sfx.whistle();
    this.asUI(() => {
      const t = titleText(this, CENTER_X, MID_Y - 150, '¡GOL DE ORO!', 72, PALETTE.yellow).setDepth(12).setScale(0.3);
      const sub = uiText(this, CENTER_X, MID_Y - 85, 'El próximo gol gana', 24).setDepth(12).setAlpha(0);
      this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.Out' });
      this.tweens.add({ targets: sub, alpha: 1, duration: 300 });
      this.tweens.add({ targets: [t, sub], alpha: 0, delay: 1800, duration: 400, onComplete: () => { t.destroy(); sub.destroy(); } });
    });
  }

  showWin(scorer) {
    this.state = 'over';
    const loser = scorer === this.p1 ? this.p2 : this.p1;
    scorer.mood = 'happy';
    loser.mood = 'dizzy';
    scorer.moodUntil = loser.moodUntil = Infinity;
    this.renderFrame(0, 0);
    stopMatchMusic();
    sfx.win();
    const name = scorer === this.p1 ? this.p1Name : this.p2Name;
    this.asUI(() => {
      this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.5).setOrigin(0).setDepth(9);
      this.showBanner('¡GANÓ!', name.toUpperCase(), false);
      uiText(this, CENTER_X, MID_Y + 150, `${this.score.p1}  -  ${this.score.p2}`, 40).setDepth(11);
      uiText(this, CENTER_X, MID_Y + 220, 'R / A: JUGAR DE NUEVO   ·   ESC / B: MENÚ', 22, PALETTE.yellow).setDepth(11);
    });
  }

  // Plays a chant for whoever is losing: 2-3 goals behind, then 4 or more. Each one plays
  // once when that deficit is reached; catching up and falling behind again replays it.
  // Against the bot it's only for player 1; in 1 vs 1 for either player.
  updateChant() {
    const diff = this.score.p2 - this.score.p1;
    let side = null;
    if (diff > 0) side = 'p1';
    else if (diff < 0 && !this.bot) side = 'p2';
    const deficit = side ? Math.abs(diff) : 0;
    const rank = deficit >= 4 ? 2 : deficit >= 2 ? 1 : 0;

    if (side !== this.chant.side) this.chant = { side, rank: 0 };
    if (rank > this.chant.rank) playChant(rank === 2 ? 'losing4' : 'losing2');
    this.chant.rank = rank;
  }

  // Final whistle of a tournament match: save the result and show it.
  endLeagueMatch() {
    this.state = 'over';
    stopChant();
    stopMatchMusic();
    if (!this.goldenGoal) {
      this.timeLeft = 0;
      this.updateClock();
    }
    this.ball.vx = this.ball.vy = 0;
    this.trailGfx.clear();
    this.speedText.setText('x1.0');
    sfx.whistle();
    this.match.record(this.score.p1, this.score.p2);
    this.showResult('¡FINAL!');
  }

  showResult(title) {
    const { p1, p2 } = this.score;
    let verdict = ['EMPATE  ·  +1 PUNTO', PALETTE.white];
    if (this.match.knockout) {
      verdict = p1 > p2 ? ['¡GANASTE!  ·  PASÁS DE RONDA', PALETTE.yellow] : ['PERDISTE  ·  QUEDÁS AFUERA', '#ff9aa3'];
    } else if (p1 > p2) verdict = ['¡GANASTE!  ·  +3 PUNTOS', PALETTE.yellow];
    else if (p1 < p2) verdict = ['PERDISTE  ·  0 PUNTOS', '#ff9aa3'];
    if (p1 > p2) sfx.win();
    this.asUI(() => {
      this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.5).setOrigin(0).setDepth(9);
      this.showBanner(title, `${this.p1Name} ${p1} - ${p2} ${this.p2Name}`, false);
      uiText(this, CENTER_X, MID_Y + 160, verdict[0], 34, verdict[1]).setDepth(11);
      uiText(this, CENTER_X, MID_Y + 230, 'ENTER / A: CONTINUAR', 22).setDepth(11);
    });
  }

  // Esc / Start pauses. You can resume, or quit: leaving a league match counts as a 0-3 loss.
  togglePause() {
    this.paused = !this.paused;
    this.time.paused = this.paused;
    if (this.paused) {
      pauseChant();
      pauseLoops();
      this.tweens.pauseAll();
      this.pauseLayer = this.asUI(() => this.add.container(0, 0, [
        this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.ink, 0.6).setOrigin(0),
        titleText(this, CENTER_X, MID_Y - 60, 'PAUSA', 96),
        uiText(this, CENTER_X, MID_Y + 50, 'ESC / START: SEGUIR JUGANDO', 24),
        uiText(this, CENTER_X, MID_Y + 100,
          this.match ? 'Q / SELECT: ABANDONAR (PERDÉS 0-3)' : 'Q / SELECT: SALIR AL MENÚ', 24, '#ff9aa3'),
      ]).setDepth(20));
    } else {
      resumeChant();
      resumeLoops();
      this.tweens.resumeAll();
      this.pauseLayer.destroy();
    }
  }

  // Q / Select while paused: leave the league match (as a loss) or the friendly.
  quitFromPause() {
    if (this.match) {
      this.abandonLeagueMatch();
      return;
    }
    this.togglePause(); // resume first: the screen transition runs on tweens
    goTo(this, 'Menu');
  }

  abandonLeagueMatch() {
    this.togglePause();
    this.time.removeAllEvents();
    this.state = 'over';
    stopChant();
    stopMatchMusic();
    this.score = { p1: 0, p2: 3 };
    this.updateHud();
    this.match.record(0, 3);
    this.showResult('ABANDONASTE');
  }

  showBanner(title, subtitle, autoHide) {
    if (this.banner) {
      this.tweens.killTweensOf(this.banner);
      this.banner.destroy();
    }
    const banner = this.asUI(() => {
      const big = titleText(this, 0, -40, title, 96);
      const band = ribbon(this, 0, 50, subtitle, 380, 56);
      return this.add.container(CENTER_X, MID_Y, [band, big]).setDepth(10).setAngle(-6).setScale(0.2);
    });
    this.banner = banner;
    this.tweens.add({ targets: banner, scale: 1, duration: 380, ease: 'Back.Out' });
    if (autoHide) {
      this.tweens.add({
        targets: banner, alpha: 0, scale: 1.3, delay: GOAL_PAUSE - 350, duration: 300,
        onComplete: () => banner.destroy(),
      });
    }
  }

  confetti(x, y, dirY) {
    for (let i = 0; i < 70; i++) {
      const piece = this.add.rectangle(x, y, 8, 14, Phaser.Utils.Array.GetRandom(CONFETTI))
        .setStrokeStyle(2, COLORS.ink).setDepth(7);
      this.tweens.add({
        targets: piece,
        x: x + Phaser.Math.Between(-330, 330),
        y: y + dirY * Phaser.Math.Between(120, 520),
        angle: Phaser.Math.Between(-900, 900),
        alpha: 0,
        duration: Phaser.Math.Between(900, 1500),
        ease: 'Cubic.Out',
        onComplete: () => piece.destroy(),
      });
    }
  }

  burst(x, y, size) {
    const b = this.add.image(x, y, 'burst').setDepth(6).setScale(size * 0.3).setAngle(Phaser.Math.Between(0, 360));
    this.tweens.add({
      targets: b, scale: size, alpha: 0, angle: b.angle + 40, duration: 260, ease: 'Cubic.Out',
      onComplete: () => b.destroy(),
    });
  }

  // Shows a floating word unless the same one was shown in the last `cooldown` ms.
  shout(id, text, color, cooldown = 900, size = 34) {
    const now = this.time.now;
    if (now < (this.cooldowns[id] ?? 0)) return false;
    this.cooldowns[id] = now + cooldown;
    floatText(this, this.ball.x, this.ball.y - 40, text, color, size);
    return true;
  }

  slowmo(ms) {
    this.slowmoUntil = Math.max(this.slowmoUntil, this.time.now + ms);
  }

  // Counts every bounce of the rally and celebrates every 10.
  touch() {
    this.rally++;
    if (this.rally % 10 === 0) this.shout('rally', `¡${this.rally} REBOTES!`, PALETTE.cyan, 0, 28);
  }

  // ---------- replay ----------

  startReplay(done) {
    const clip = this.replay.clip(REPLAY_CLIP);
    if (clip.length < 5) {
      done();
      return;
    }
    this.state = 'replay';
    this.replayClip = clip;
    this.replayT = 0;
    this.replayIdx = 0;
    this.replayDone = done;
    this.trail.length = 0;
    for (const p of [this.p1, this.p2]) p.moodUntil = 0;
    if (this.banner) this.banner.destroy();
    this.banner = null;

    this.replayUI = this.asUI(() => {
      const top = this.add.rectangle(0, -100, GAME_W, 100, COLORS.ink, 0.92).setOrigin(0);
      const bottom = this.add.rectangle(0, GAME_H, GAME_W, 80, COLORS.ink, 0.92).setOrigin(0);
      const dot = this.add.circle(46, -50, 11, 0xff3040).setStrokeStyle(3, 0xffffff);
      const label = titleText(this, 210, -50, 'REPETICIÓN', 36);
      const skip = uiText(this, GAME_W - 30, GAME_H + 40, 'ESPACIO / A: SALTAR', 18, PALETTE.yellow).setOrigin(1, 0.5);
      this.tweens.add({ targets: [top, dot, label], y: '+=100', duration: 250, ease: 'Cubic.Out' });
      this.tweens.add({ targets: [bottom, skip], y: '-=80', duration: 250, ease: 'Cubic.Out' });
      this.tweens.add({ targets: dot, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
      return this.add.container(0, 0, [top, bottom, dot, label, skip]).setDepth(15);
    });
  }

  stepReplay(delta) {
    this.replayT += delta * REPLAY_SPEED;
    const clip = this.replayClip;
    while (this.replayIdx < clip.length - 1 && clip[this.replayIdx + 1].t <= this.replayT) this.replayIdx++;
    const f = clip[this.replayIdx];
    Object.assign(this.ball, { x: f.bx, y: f.by, vx: f.bvx, vy: f.bvy });
    Object.assign(this.p1, { x: f.p1x, y: f.p1y, vx: 0, vy: 0, kickHeld: f.p1k });
    Object.assign(this.p2, { x: f.p2x, y: f.p2y, vx: 0, vy: 0, kickHeld: f.p2k });
    this.renderFrame((delta / 1000) * REPLAY_SPEED, delta / 1000);
    if (this.replayT > clip[clip.length - 1].t + 350) this.endReplay();
  }

  endReplay() {
    if (this.replayUI) this.replayUI.destroy();
    this.replayUI = null;
    this.trail.length = 0;
    this.ball.vx = this.ball.vy = 0;
    this.state = 'goal';
    const done = this.replayDone;
    this.replayDone = null;
    if (done) done();
  }

  // ---------- loop ----------

  update(time, delta) {
    const k = this.keys;
    const pressed = (key) => Phaser.Input.Keyboard.JustDown(key);
    const realDt = Math.min(delta / 1000, 1 / 20);

    pollPads().forEach((n) => padToast(this, n));
    const pads = [pad(0), pad(1)].filter(Boolean);
    const padPressed = (...btns) => pads.some((p) => btns.some((b) => p.pressed(b)));

    if (this.state === 'over') {
      if (this.match) {
        if (pressed(k.enter) || pressed(k.space) || padPressed(BTN.A, BTN.START)) goTo(this, this.match.back.scene, this.match.back.data);
      } else if (pressed(k.esc) || padPressed(BTN.B, BTN.START)) {
        goTo(this, 'Menu');
      } else if (pressed(k.r) || padPressed(BTN.A)) {
        goTo(this, 'Game', { mode: this.mode, level: this.level, teams: this.teams, hazards: this.hazardsOn });
      }
      return;
    }
    if (this.paused) {
      if (pressed(k.esc) || pressed(k.enter) || padPressed(BTN.START, BTN.A)) this.togglePause();
      else if (pressed(k.q) || padPressed(BTN.SELECT)) this.quitFromPause();
      return;
    }
    if (pressed(k.esc) || padPressed(BTN.START)) {
      this.togglePause();
      return;
    }

    if (this.state === 'replay') {
      if (pressed(k.space) || pressed(k.enter) || padPressed(BTN.A, BTN.START)) this.endReplay();
      else this.stepReplay(delta);
      return;
    }
    if (this.state === 'goal') {
      this.renderFrame(realDt, realDt);
      return;
    }
    // Hit-stop: freeze the action for a few frames after a big hit.
    if (this.hitstop > 0) {
      this.hitstop -= delta;
      this.updateCamera(realDt);
      return;
    }

    const scale = time < this.slowmoUntil ? SLOWMO : 1;

    if (this.match && this.state === 'playing' && !this.goldenGoal) {
      const before = Math.ceil(this.timeLeft / 1000);
      this.timeLeft -= delta * scale;
      const after = Math.ceil(this.timeLeft / 1000);
      if (after !== before && after <= 10 && after > 0) {
        sfx.tick();
        this.tweens.add({ targets: this.clockText, scale: 1.25, duration: 90, yoyo: true });
      }
      this.updateClock();
      if (this.timeLeft <= 0) {
        if (this.match.knockout && this.score.p1 === this.score.p2) {
          this.startGoldenGoal();
        } else {
          this.endLeagueMatch();
          return;
        }
      }
    }

    const dt = realDt * scale;

    // Joysticks: in 1 vs 1 the first one is player 1 and the second player 2; against
    // the bot any joystick controls player 1. The keyboard works alongside.
    const p1Pads = this.bot ? pads : pads.slice(0, 1);
    const p2Pads = this.bot ? [] : pads.slice(1, 2);

    // Player 1 also gets the arrows when there's no second human.
    const p1Keys = normalize(
      (k.d.isDown || (this.bot && k.right.isDown) ? 1 : 0) - (k.a.isDown || (this.bot && k.left.isDown) ? 1 : 0),
      (k.s.isDown || (this.bot && k.down.isDown) ? 1 : 0) - (k.w.isDown || (this.bot && k.up.isDown) ? 1 : 0),
    );
    this.applyInput(this.p1, mergeMove(p1Keys, p1Pads), time, {
      kickPressed: Phaser.Input.Keyboard.JustDown(k.space) || (this.bot && Phaser.Input.Keyboard.JustDown(k.enter))
        || p1Pads.some((p) => p.kickPressed),
      kickHeld: k.space.isDown || (this.bot && k.enter.isDown) || p1Pads.some((p) => p.kickHeld),
    });

    if (p1Pads.some((p) => p.dashPressed)) this.dashQueued.add(this.p1);
    if (p2Pads.some((p) => p.dashPressed)) this.dashQueued.add(this.p2);

    if (this.bot) {
      const { move, kick, dash } = this.bot.update(time);
      this.applyInput(this.p2, move, time, { kickPressed: kick, kickHeld: kick });
      if (dash) this.dashQueued.add(this.p2);
    } else {
      const p2Keys = normalize(
        (k.right.isDown ? 1 : 0) - (k.left.isDown ? 1 : 0),
        (k.down.isDown ? 1 : 0) - (k.up.isDown ? 1 : 0),
      );
      this.applyInput(this.p2, mergeMove(p2Keys, p2Pads), time, {
        kickPressed: Phaser.Input.Keyboard.JustDown(k.enter) || p2Pads.some((p) => p.kickPressed),
        kickHeld: k.enter.isDown || p2Pads.some((p) => p.kickHeld),
      });
    }

    if (this.state === 'playing') this.playTime += dt * 1000;
    this.updateDash(dt);
    for (const p of [this.p1, this.p2]) this.applyStatus(p, dt);
    for (const p of [this.p1, this.p2]) this.movePlayer(p, dt);

    if (this.state === 'playing') {
      for (const p of [this.p1, this.p2]) this.tryKick(p, time);
      this.stepBall(dt);
      if (this.state === 'playing') {
        this.hazards?.update(this.playTime, this.ball, [this.p1, this.p2]);
        this.replay.record(time, this.ball, this.p1, this.p2);
        this.checkDrama();
      }
    }

    this.renderFrame(dt, realDt);
  }

  // Slow motion when a goal is about to decide the match: last seconds of a league
  // match, or match point in the 5-goal modes.
  checkDrama() {
    const now = this.time.now;
    if (now < (this.cooldowns.drama ?? 0)) return;
    const b = this.ball;
    for (const [side, attacker] of [['top', 'p1'], ['bottom', 'p2']]) {
      if (!headingIntoGoal(b, b.vx, b.vy, side, 0.2)) continue;
      const decisive = this.match ? this.timeLeft < 6000 : this.score[attacker] === WIN_GOALS - 1;
      if (decisive) {
        this.slowmo(650);
        this.cooldowns.drama = now + 2000;
      }
    }
  }

  // Dash bars fill during play. A queued dash (Shift / R1 / bot) fires only with a full
  // bar and while moving: for DASH.duration the player shoots along their direction.
  updateDash(dt) {
    const playing = this.state === 'playing';
    for (const p of [this.p1, this.p2]) {
      if (playing && p.dash < 1) {
        p.dash = Math.min(1, p.dash + (dt * 1000) / DASH.charge);
        if (p.dash === 1) {
          sfx.dashReady();
          floatText(this, p.x, p.y - 50, '¡DASH LISTO!', PALETTE.cyan, 22);
        }
      }

      const moving = p.vx || p.vy;
      const frozen = this.playTime < p.frozenUntil;
      if (playing && this.dashQueued.has(p) && p.dash >= 1 && p.dashLeft <= 0 && moving && !frozen) {
        const len = Math.hypot(p.vx, p.vy);
        p.dashDir = { x: p.vx / len, y: p.vy / len };
        p.dashLeft = DASH.duration;
        p.dash = 0;
        p.squash = 0.8;
        sfx.dash();
        this.cameras.main.shake(80, 0.003);
        this.dust.emit(p.x - p.dashDir.x * PLAYER_R, p.y - p.dashDir.y * PLAYER_R, {
          count: 8, speed: [60, 160], angle: Phaser.Math.RadToDeg(Math.atan2(-p.dashDir.y, -p.dashDir.x)), spread: 70,
          life: [300, 500], size: [5, 8], grow: 1, colors: [0xffffff, 0xe8ffd0], alpha: 0.7, drag: 3,
        });
      }

      if (p.dashLeft > 0) {
        p.dashLeft -= dt * 1000;
        p.vx = p.dashDir.x * DASH.speed;
        p.vy = p.dashDir.y * DASH.speed;
        // Fading after-images of the player.
        this.dust.emit(p.x, p.y, { count: 1, speed: 0, life: 200, size: PLAYER_R * 0.95, grow: -0.3, colors: [p.color], alpha: 0.4 });
      }
    }
    this.dashQueued.clear();
  }

  // Ice: the player moves at HAZARDS.freezeSpeed (0: stuck in place). Soap: the velocity only slowly
  // catches up with the input, so the player slides and overshoots. A dash ignores both.
  applyStatus(p, dt) {
    if (p.dashLeft > 0) {
      p.mvx = p.vx;
      p.mvy = p.vy;
      return;
    }
    if (this.playTime < p.frozenUntil) {
      p.vx *= HAZARDS.freezeSpeed;
      p.vy *= HAZARDS.freezeSpeed;
    }
    if (this.playTime < p.slipUntil) {
      const grip = 1 - Math.exp(-HAZARDS.soapGrip * dt);
      p.mvx += (p.vx - p.mvx) * grip;
      p.mvy += (p.vy - p.mvy) * grip;
      p.vx = p.mvx;
      p.vy = p.mvy;
    } else {
      p.mvx = p.vx;
      p.mvy = p.vy;
    }
  }

  applyInput(p, move, time, { kickPressed, kickHeld }) {
    p.vx = move.x * PLAYER_SPEED;
    p.vy = move.y * PLAYER_SPEED;
    if (kickPressed) p.armedUntil = time + KICK.buffer;
    p.kickHeld = kickHeld;
  }

  movePlayer(p, dt) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    this.clampPlayer(p);
  }

  // Each player stays fully inside their own half and inside the rounded corners.
  clampPlayer(p) {
    p.x = Phaser.Math.Clamp(p.x, FIELD.left + PLAYER_R, FIELD.right - PLAYER_R);
    if (p.side === 'bottom') p.y = Phaser.Math.Clamp(p.y, MID_Y + PLAYER_R, FIELD.bottom - PLAYER_R);
    else p.y = Phaser.Math.Clamp(p.y, FIELD.top + PLAYER_R, MID_Y - PLAYER_R);

    const corner = cornerCenter(p.x, p.y);
    if (corner) {
      const dx = p.x - corner.x;
      const dy = p.y - corner.y;
      const dist = Math.hypot(dx, dy);
      const max = CORNER_R - PLAYER_R;
      if (dist > max) {
        p.x = corner.x + (dx / dist) * max;
        p.y = corner.y + (dy / dist) * max;
      }
    }
  }

  // The bot's settings if `p` is the bot-controlled player, else null.
  botCfg(p) {
    return this.bot && p === this.p2 ? this.bot.cfg : null;
  }

  tryKick(p, time) {
    if (time > p.armedUntil || time - p.lastKick < KICK.cooldown) return;
    const b = this.ball;
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > PLAYER_R + BALL_R + KICK.reach || dist === 0) return;
    const wasShot = headingIntoGoal(b, b.vx, b.vy, p.side);

    // Haxball-style: the ball flies along the line from the player's centre to the ball.
    const nx = dx / dist;
    const ny = dy / dist;
    // Kicking in the middle of a dash is a power shot.
    const dashing = p.dashLeft > 0;
    const power = (dashing ? DASH.kickBoost : 1) * (this.botCfg(p)?.kickPower ?? 1);
    const speed = Math.min(BALL.maxSpeed, Math.max(this.ballSpeed() * BALL.kickBoost, BALL.kickMin) * power);
    b.vx = nx * speed;
    b.vy = ny * speed;
    if (dist < PLAYER_R + BALL_R) {
      b.x = p.x + nx * (PLAYER_R + BALL_R + 0.5);
      b.y = p.y + ny * (PLAYER_R + BALL_R + 0.5);
    }
    p.lastKick = time;
    p.armedUntil = 0;
    p.squash = 1;
    b.lastTouch = p;

    const ratio = this.speedRatio();
    sfx.kick();
    this.burst(b.x, b.y, 0.55 + 0.45 * ratio);
    this.grass.emit(b.x, b.y, {
      count: 9, speed: [120, 280], angle: Phaser.Math.RadToDeg(Math.atan2(ny, nx)) + 180, spread: 80,
      life: [300, 600], size: [3, 5], colors: [0x6fbf2a, 0x9be33b, 0x4f9a1f], shape: 'rect', drag: 4,
    });
    this.cameras.main.shake(60, 0.002 + 0.006 * ratio);
    if (ratio > 0.45 || dashing) {
      this.hitstop = 45 + 70 * Math.max(ratio, 0.6);
      this.shout('zap', dashing ? '¡SUPER ZAPATAZO!' : '¡ZAPATAZO!', PALETTE.yellow);
    }
    if (wasShot) this.shout('save', '¡ATAJADA!', PALETTE.cyan, 1200);
    this.touch();
  }

  // Moves the ball in small sub-steps (never more than half its radius) so it can't
  // tunnel through walls, posts or players no matter how fast it goes.
  stepBall(dt) {
    const b = this.ball;
    const travel = this.ballSpeed() * dt;
    const steps = Math.max(1, Math.ceil(travel / (BALL_R * 0.5)));
    const h = dt / steps;

    for (let i = 0; i < steps; i++) {
      b.x += b.vx * h;
      b.y += b.vy * h;
      this.collideWalls();
      for (const post of POSTS) this.collidePost(post);
      for (const p of [this.p1, this.p2]) this.collidePlayer(p);

      if (b.y < FIELD.top - BALL_R) return this.goal(this.p1);
      if (b.y > FIELD.bottom + BALL_R) return this.goal(this.p2);
    }
  }

  // `boost` is off when re-checking a ball squeezed by a player, so pinning the ball
  // against a wall can't be used to pump its speed up.
  collideWalls(boost = true) {
    const b = this.ball;
    const { left, right, top, bottom } = FIELD;
    const inMouth = b.x > MOUTH_L && b.x < MOUTH_R;
    const bounce = (endLine = false) => boost && this.wallBounce(endLine);

    if (b.x - BALL_R < left) { b.x = left + BALL_R; b.vx = Math.abs(b.vx); bounce(); }
    if (b.x + BALL_R > right) { b.x = right - BALL_R; b.vx = -Math.abs(b.vx); bounce(); }
    if (!inMouth) {
      if (b.y - BALL_R < top) { b.y = top + BALL_R; b.vy = Math.abs(b.vy); bounce(true); }
      if (b.y + BALL_R > bottom) { b.y = bottom - BALL_R; b.vy = -Math.abs(b.vy); bounce(true); }
    }

    // Rounded corners: keep the ball inside the quarter circle and reflect off the curve.
    const corner = cornerCenter(b.x, b.y);
    if (corner) {
      const dx = b.x - corner.x;
      const dy = b.y - corner.y;
      const dist = Math.hypot(dx, dy);
      const max = CORNER_R - BALL_R;
      if (dist > max) {
        const nx = dx / dist;
        const ny = dy / dist;
        b.x = corner.x + nx * max;
        b.y = corner.y + ny * max;
        const dot = b.vx * nx + b.vy * ny;
        if (dot > 0) {
          b.vx -= 2 * dot * nx;
          b.vy -= 2 * dot * ny;
          bounce();
        }
      }
    }
  }

  collidePost(post) {
    const b = this.ball;
    const dx = b.x - post.x;
    const dy = b.y - post.y;
    const dist = Math.hypot(dx, dy);
    const minDist = BALL_R + POST_R;
    if (dist >= minDist || dist === 0) return;
    const nx = dx / dist;
    const ny = dy / dist;
    b.x = post.x + nx * minDist;
    b.y = post.y + ny * minDist;
    const dot = b.vx * nx + b.vy * ny;
    if (dot < 0) {
      b.vx -= 2 * dot * nx;
      b.vy -= 2 * dot * ny;
      this.wallBounce();
      if (this.shout('post', '¡PALO!', PALETTE.white, 700)) {
        sfx.post();
        playSound('ooh');
        this.slowmo(350);
        this.burst(post.x, post.y, 0.5);
      }
    }
  }

  collidePlayer(p) {
    const b = this.ball;
    let dx = b.x - p.x;
    let dy = b.y - p.y;
    let dist = Math.hypot(dx, dy);
    const minDist = PLAYER_R + BALL_R;
    if (dist >= minDist) return;
    if (dist === 0) { dx = 0; dy = p.side === 'bottom' ? -1 : 1; dist = 1; }
    const nx = dx / dist;
    const ny = dy / dist;

    b.x = p.x + nx * minDist;
    b.y = p.y + ny * minDist;

    // Bounce off the body relative to how the player is moving, then cushion it.
    const rvx = b.vx - p.vx;
    const rvy = b.vy - p.vy;
    const dot = rvx * nx + rvy * ny;
    if (dot < 0) {
      const preVx = b.vx;
      const preVy = b.vy;
      const preRatio = this.speedRatio();
      b.vx = rvx - 2 * dot * nx + p.vx;
      b.vy = rvy - 2 * dot * ny + p.vy;
      this.setBallSpeed(this.ballSpeed() * (this.botCfg(p)?.bodyDamp ?? BALL.bodyDamp));
      b.lastTouch = p;
      sfx.body();
      p.squash = Math.max(p.squash, 0.4 + 0.6 * preRatio);
      if (preRatio > 0.5) this.hitstop = Math.max(this.hitstop, 40);
      if (headingIntoGoal(b, preVx, preVy, p.side) && !headingIntoGoal(b, b.vx, b.vy, p.side)) {
        this.shout('save', '¡ATAJADA!', PALETTE.cyan, 1200);
      }
      this.touch();
    }

    // If the ball got pinned against a wall, push the player back instead.
    this.collideWalls(false);
    const odx = b.x - p.x;
    const ody = b.y - p.y;
    const overlap = minDist - Math.hypot(odx, ody);
    if (overlap > 0) {
      p.x -= nx * overlap;
      p.y -= ny * overlap;
      this.clampPlayer(p);
    }
  }

  // endLine: the bounce was on a goal line. If it was right next to a post, the crowd
  // goes "uuuh".
  wallBounce(endLine = false) {
    const b = this.ball;
    this.setBallSpeed(this.ballSpeed() * BALL.wallBoost);
    const ratio = this.speedRatio();
    sfx.wall(ratio);
    this.ballSquash = 1;
    this.touch();
    if (ratio > 0.3) {
      this.dust.emit(b.x, b.y, {
        count: 4, speed: [30, 90], life: [250, 450], size: [3, 6], grow: 0.8,
        colors: [0xffffff, 0xe8ffd0], alpha: 0.7, drag: 3,
      });
    }
    if (endLine && ratio > 0.15) {
      const nearPost = Math.min(Math.abs(b.x - MOUTH_L), Math.abs(b.x - MOUTH_R)) < 55;
      if (nearPost && this.shout('uuh', '¡UUUH!', PALETTE.white, 1200)) {
        playSound('ooh');
        this.slowmo(300);
      }
    }
  }

  ballSpeed() {
    return Math.hypot(this.ball.vx, this.ball.vy);
  }

  speedRatio() {
    return Math.max(0, (this.ballSpeed() - BALL.baseSpeed) / (BALL.maxSpeed - BALL.baseSpeed));
  }

  // Sets the speed (keeping the direction), within [baseSpeed, maxSpeed], and makes
  // sure the ball always keeps some vertical movement.
  setBallSpeed(speed) {
    const b = this.ball;
    const current = this.ballSpeed();
    if (current === 0) return;
    const s = Phaser.Math.Clamp(speed, BALL.baseSpeed, BALL.maxSpeed);
    let vx = (b.vx / current) * s;
    let vy = (b.vy / current) * s;
    const minVy = s * BALL.minVerticalRatio;
    if (Math.abs(vy) < minVy) {
      vy = (vy < 0 || (vy === 0 && b.y > MID_Y) ? -1 : 1) * minVy;
      vx = Math.sign(vx || 1) * Math.sqrt(s * s - vy * vy);
    }
    b.vx = vx;
    b.vy = vy;
  }

  // ---------- drawing ----------

  // dt: game time (slowed down in slow motion); realDt: wall-clock time, for things
  // like the camera that shouldn't slow down.
  renderFrame(dt, realDt) {
    const b = this.ball;
    const now = this.time.now;
    const live = this.state === 'playing' || this.state === 'replay';
    const ratio = live ? this.speedRatio() : 0;

    this.shadows.clear();
    this.shadows.fillStyle(COLORS.ink, 0.3);
    for (const p of [this.p1, this.p2]) this.shadows.fillCircle(p.x + 5, p.y + 7, PLAYER_R);
    this.shadows.fillCircle(b.x + 4, b.y + 6, BALL_R);

    // Status effects: a soapy puddle with bubbles under slippery players, an ice cube
    // around frozen ones (the eyes are drawn on top, peeking out).
    this.statusGfx.clear();
    for (const p of [this.p1, this.p2]) {
      if (this.playTime < p.slipUntil) {
        this.shadows.fillStyle(0xffc2e2, 0.45);
        this.shadows.fillEllipse(p.x, p.y + 10, PLAYER_R * 3, PLAYER_R * 1.6);
        p.bubbleTimer = (p.bubbleTimer ?? 0) + realDt;
        if (p.bubbleTimer > 0.12) {
          p.bubbleTimer = 0;
          this.dust.emit(p.x + (Math.random() - 0.5) * PLAYER_R * 2, p.y + (Math.random() - 0.5) * PLAYER_R, {
            count: 1, speed: [10, 30], life: [500, 800], size: [3, 6], grow: 0.5,
            colors: [0xffffff, 0xffc2e2, 0xd8f4ff], alpha: 0.85,
          });
        }
      }
      if (this.playTime < p.frozenUntil) {
        const half = PLAYER_R + 6;
        const g = this.statusGfx;
        g.fillStyle(0xbff0ff, 0.55);
        g.fillRoundedRect(p.x - half, p.y - half, half * 2, half * 2, 10);
        g.lineStyle(3, 0xffffff, 0.9);
        g.strokeRoundedRect(p.x - half, p.y - half, half * 2, half * 2, 10);
        g.lineStyle(3, 0xffffff, 0.8);
        g.lineBetween(p.x - half + 8, p.y - half + 10, p.x - half + 8, p.y + 4);
        g.lineBetween(p.x - half + 15, p.y - half + 10, p.x - half + 15, p.y - 6);
      }
    }

    // Players: squash after hits, dust while running, a white ring while the kick key
    // is held (like in Haxball).
    this.rings.clear();
    this.drawDashBars(now);
    // Dash charge ring around each player: a growing arc, a pulsing yellow circle when full.
    for (const p of [this.p1, this.p2]) {
      const r = PLAYER_R + 11;
      if (p.dash >= 1) {
        this.rings.lineStyle(4, COLORS.yellow, 0.6 + 0.4 * Math.sin(now / 120));
        this.rings.strokeCircle(p.x, p.y, r);
      } else if (p.dash > 0) {
        this.rings.lineStyle(3, 0xffffff, 0.35);
        this.rings.beginPath();
        this.rings.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + p.dash * Math.PI * 2);
        this.rings.strokePath();
      }
    }
    for (const p of [this.p1, this.p2]) {
      p.squash = Math.max(0, p.squash - realDt * 5);
      p.sprite.setPosition(p.x, p.y);
      p.sprite.setScale(SPRITE_SCALE * (1 + 0.2 * p.squash), SPRITE_SCALE * (1 - 0.2 * p.squash));
      if (p.kickHeld) {
        this.rings.lineStyle(5, 0xffffff, 0.9);
        this.rings.strokeCircle(p.x, p.y, PLAYER_R + 6);
      }
      const speed = Math.hypot(p.vx, p.vy);
      p.dustTimer += dt;
      if (speed > 50 && p.dustTimer > 0.08) {
        p.dustTimer = 0;
        this.dust.emit(p.x - (p.vx / speed) * PLAYER_R * 0.7, p.y - (p.vy / speed) * PLAYER_R * 0.7, {
          count: 1, speed: [10, 30], angle: Phaser.Math.RadToDeg(Math.atan2(-p.vy, -p.vx)), spread: 90,
          life: [350, 500], size: [4, 6], grow: 1.2, colors: [0xf3ffe0, 0xd9f5b0], alpha: 0.55,
        });
      }
    }

    this.eyesGfx.clear();
    for (const p of [this.p1, this.p2]) {
      const mood = p.moodUntil > now ? p.mood : (p.kickHeld ? 'angry' : 'normal');
      drawEyes(this.eyesGfx, p, b, now, mood);
    }

    // Speed trail, brighter and longer the faster the ball goes.
    this.trailGfx.clear();
    if (live) {
      this.trail.push({ x: b.x, y: b.y });
      if (this.trail.length > TRAIL_LEN) this.trail.shift();
      if (ratio > 0.12) {
        const color = ratio > 0.55 ? COLORS.yellow : 0xffffff;
        this.trail.forEach((pt, i) => {
          const t = i / this.trail.length;
          this.trailGfx.fillStyle(color, t * 0.55 * Math.min(1, ratio * 2));
          this.trailGfx.fillCircle(pt.x, pt.y, BALL_R * (0.35 + 0.65 * t));
        });
      }
    }

    // On fire near top speed.
    if (live && ratio > FIRE_ON && !this.onFire) {
      this.onFire = true;
      if (this.state === 'playing') {
        this.shout('fire', '¡A FUEGO!', '#ff8a3d', 3000, 40);
        sfx.fire();
      }
    } else if (ratio < FIRE_OFF) {
      this.onFire = false;
    }
    if (this.onFire && live) {
      const back = Phaser.Math.RadToDeg(Math.atan2(-b.vy, -b.vx));
      this.fire.emit(b.x, b.y, {
        count: 3, speed: [40, 110], angle: back, spread: 50, life: [250, 420], size: [7, 11],
        grow: -0.7, colors: FIRE_COLORS, gradient: true, alpha: 0.9,
      });
      this.fire.emit(b.x, b.y, { count: 1, speed: 0, life: 60, size: 24, colors: [0xff8a3d], alpha: 0.35 });
    }

    // Ball: stretched along its velocity when fast, squashed right after a bounce.
    const speed = this.ballSpeed();
    this.ballSquash = Math.max(0, this.ballSquash - realDt * 9);
    const stretch = 1 + 0.45 * ratio;
    const sprite = b.sprite;
    if (speed > 1) sprite.rotation = Math.atan2(b.vy, b.vx);
    sprite.setPosition(b.x, b.y);
    sprite.setScale(stretch * (1 - 0.35 * this.ballSquash), (1 / stretch) * (1 + 0.3 * this.ballSquash));
    this.ballSpin += (speed * dt / BALL_R) * 0.35 * Math.sign(b.vx || 1);
    this.ballBody.rotation = this.ballSpin - sprite.rotation;

    this.dust.update(dt);
    this.fire.update(dt);
    this.grass.update(dt);
    if (!drawNetRipple(this.netGfx, this.net, now)) this.net = null;
    if (!drawCrowd(this.crowdGfx, this.fans, this.celebration, now)) this.celebration = null;
    this.updateCamera(realDt);

    if (this.state === 'playing') this.speedText.setText(`x${(speed / BALL.baseSpeed).toFixed(1)}`);
  }

  // Gentle zoom that follows the ball as it speeds up; punches in on goals and slow
  // motion, and goes close for the replay.
  updateCamera(realDt) {
    const b = this.ball;
    const now = this.time.now;
    let zoom = 1;
    let x = CENTER_X;
    let y = GAME_H / 2;
    if (this.state === 'replay') {
      zoom = 1.35;
      x = b.x;
      y = b.y;
    } else if (this.camPunch && now < this.camPunch.until) {
      zoom = 1.18;
      x = this.camPunch.x;
      y = this.camPunch.y;
    } else if (this.state === 'playing') {
      const ratio = this.speedRatio();
      const slow = now < this.slowmoUntil;
      zoom = 1 + 0.07 * ratio + (slow ? 0.12 : 0);
      const follow = slow ? 0.8 : 0.45;
      x = CENTER_X + (b.x - CENTER_X) * follow;
      y = GAME_H / 2 + (b.y - GAME_H / 2) * follow;
    }
    const a = 1 - Math.exp(-realDt * 5);
    this.cam.zoom += (zoom - this.cam.zoom) * a;
    this.cam.x += (x - this.cam.x) * a;
    this.cam.y += (y - this.cam.y) * a;
    const cam = this.cameras.main;
    cam.setZoom(this.cam.zoom);
    cam.centerOn(this.cam.x, this.cam.y);
  }
}

// Centre of the rounded corner the point is in, or null if it isn't in a corner zone.
function cornerCenter(x, y) {
  const { left, right, top, bottom } = FIELD;
  const cx = x < left + CORNER_R ? left + CORNER_R : x > right - CORNER_R ? right - CORNER_R : null;
  const cy = y < top + CORNER_R ? top + CORNER_R : y > bottom - CORNER_R ? bottom - CORNER_R : null;
  return cx !== null && cy !== null ? { x: cx, y: cy } : null;
}

// Keyboard direction if any key is held, otherwise the first joystick that's moving
// (analog: a half-tilted stick walks at half speed).
function mergeMove(keys, pads) {
  if (keys.x || keys.y) return keys;
  const moving = pads.find((p) => p.move.x || p.move.y);
  return moving ? moving.move : keys;
}

function normalize(x, y) {
  const len = Math.hypot(x, y);
  return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
}
