// Recorded audio (files in public/audio): the menu music loop, the match background
// music (a rotation of tracks), crowd chants and one-shot sounds. The synthesized
// effects live in sound.js.
import { channelVolume, onVolumeChange } from './sound.js';
import { AUDIO } from './config.js';

const BASE = import.meta.env.BASE_URL;
const FILES = {
  menu: `${BASE}audio/musica-menu.mp3`,
  drums: `${BASE}audio/repique.mp3`,
  bg1: `${BASE}audio/fondo-1.mp3`,
  bg2: `${BASE}audio/fondo-2.mp3`,
  bg3: `${BASE}audio/fondo-3.mp3`,
  start: `${BASE}audio/canto-inicio.wav`,
  losing2: `${BASE}audio/canto-perdiendo-2.mp3`,
  losing4: `${BASE}audio/canto-perdiendo-4.mp3`,
  goal: `${BASE}audio/grito-gol.mp3`,
  ooh: `${BASE}audio/uuuh.wav`,
};
// Which volume channel (sound.js) each file belongs to: music or the stadium crowd.
const CHANNEL = {
  menu: 'music', drums: 'music', bg1: 'music', bg2: 'music', bg3: 'music',
  start: 'crowd', losing2: 'crowd', losing4: 'crowd', goal: 'crowd', ooh: 'crowd',
};
const MENU_VOLUME = AUDIO.menuMusic;
const MATCH_TRACKS = ['drums', 'bg1', 'bg2', 'bg3'];
const BG_VOLUME = AUDIO.matchMusic;
const DUCKED_BG = AUDIO.matchMusicDucked; // background volume while a chant is playing
const CHANT_VOLUME = AUDIO.chant;
const FADE_MS = 600;

// Every sound keeps its own level (audio.level, 0..1) and plays at level × its channel's
// volume, so the sound panel can turn the music or the crowd up or down at once.
const live = new Set();

function setLevel(audio, level) {
  audio.level = level;
  audio.volume = level * channelVolume(audio.channel);
}

onVolumeChange(() => live.forEach((audio) => setLevel(audio, audio.level)));

function newAudio(name, level) {
  const audio = new Audio(FILES[name]);
  audio.channel = CHANNEL[name];
  setLevel(audio, level);
  audio.addEventListener('play', () => live.add(audio));
  audio.addEventListener('ended', () => live.delete(audio));
  return audio;
}

// Browsers can refuse to play before the first click/key press; then the sound simply
// stays quiet (loops are retried by calling startLoop again).
const play = (audio) => audio.play().catch(() => {});

// Fades `audio` to `target` volume, then calls onDone.
function fadeTo(audio, target, ms, onDone) {
  clearInterval(audio.fadeTimer);
  const steps = Math.max(1, Math.round(ms / 30));
  const delta = (target - audio.level) / steps;
  let n = 0;
  audio.fadeTimer = setInterval(() => {
    n++;
    setLevel(audio, Math.min(1, Math.max(0, audio.level + delta)));
    if (n >= steps) {
      clearInterval(audio.fadeTimer);
      setLevel(audio, target);
      onDone?.();
    }
  }, 30);
}

function fadeOutAndStop(audio, ms) {
  audio.stopping = true;
  fadeTo(audio, 0, ms, () => {
    audio.pause();
    live.delete(audio);
  });
}

// ---------- menu music (loop) ----------

const loops = {};

export function startLoop(name) {
  const existing = loops[name];
  if (existing) {
    // Already there: just retry if the browser blocked it before.
    if (existing.paused && !existing.stopping) play(existing);
    return;
  }
  const audio = newAudio(name, MENU_VOLUME);
  audio.loop = true;
  loops[name] = audio;
  play(audio);
}

export function stopLoop(name, fadeMs = FADE_MS) {
  const audio = loops[name];
  if (!audio) return;
  delete loops[name];
  fadeOutAndStop(audio, fadeMs);
}

// ---------- match background music (rotation) ----------

// One track at a time, picked at random from MATCH_TRACKS (never the same one twice in
// a row). When it ends, or on every goal, it crossfades into another.
let bg = null;
let bgName = null;
let bgActive = false;

function nextTrack(fadeMs) {
  const name = pick(MATCH_TRACKS.filter((n) => n !== bgName));
  const old = bg;
  if (old) fadeOutAndStop(old, fadeMs);
  const audio = newAudio(name, 0);
  audio.addEventListener('ended', () => {
    if (bg === audio) nextTrack(300);
  });
  bg = audio;
  bgName = name;
  play(audio);
  fadeTo(audio, chant ? DUCKED_BG : BG_VOLUME, fadeMs);
}

export function startMatchMusic() {
  if (bgActive) return;
  bgActive = true;
  nextTrack(800);
}

// Called on every goal: switch to another track (or start the music if the opening
// chant is still on).
export function changeMatchTrack() {
  if (bgActive) nextTrack(800);
  else startMatchMusic();
}

export function stopMatchMusic(fadeMs = FADE_MS) {
  bgActive = false;
  const old = bg;
  bg = null;
  bgName = null;
  if (old) fadeOutAndStop(old, fadeMs);
}

export function pauseLoops() {
  for (const audio of Object.values(loops)) audio.pause();
  bg?.pause();
}

export function resumeLoops() {
  for (const audio of Object.values(loops)) play(audio);
  if (bg) play(bg);
}

// The background steps back while a chant plays so the chant is heard.
function duck(ducked) {
  if (bg) fadeTo(bg, ducked ? DUCKED_BG : BG_VOLUME, 500);
}

// ---------- chants (only one at a time) ----------

let chant = null;
let fadingChant = null;

// onDone runs once when the chant is over: it ended, was cut off by another chant or
// a stop, or couldn't play at all.
export function playChant(name, onDone) {
  stopChant(150);
  const audio = newAudio(name, CHANT_VOLUME);
  let done = false;
  audio.finish = () => {
    if (done) return;
    done = true;
    onDone?.();
  };
  audio.addEventListener('ended', () => {
    if (chant === audio) {
      chant = null;
      duck(false);
    }
    audio.finish();
  });
  audio.addEventListener('error', audio.finish);
  chant = audio;
  duck(true);
  audio.play().catch(audio.finish);
}

export function stopChant(fadeMs = FADE_MS) {
  // A chant still fading from an earlier stop is cut right away.
  if (fadingChant) {
    clearInterval(fadingChant.fadeTimer);
    fadingChant.pause();
    live.delete(fadingChant);
  }
  const audio = chant;
  chant = null;
  if (!audio) return;
  fadingChant = audio;
  duck(false);
  audio.finish();
  fadeTo(audio, 0, fadeMs, () => {
    audio.pause();
    live.delete(audio);
    if (fadingChant === audio) fadingChant = null;
  });
}

export function pauseChant() {
  chant?.pause();
}

export function resumeChant() {
  if (chant && !chant.ended) play(chant);
}

// ---------- one-shots ----------

const ONE_SHOT_VOLUME = { goal: AUDIO.goalShout, ooh: AUDIO.ooh };

export function playSound(name) {
  const audio = newAudio(name, ONE_SHOT_VOLUME[name] ?? 0.7);
  play(audio);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
