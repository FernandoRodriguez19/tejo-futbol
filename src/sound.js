// Tiny synthesized sound effects (Web Audio), so the game needs no audio files.

import { AUDIO } from './config.js';

let ctx = null;
let bus = null; // boost + limiter every effect plays through

// ---------- volume channels (shared with music.js) ----------

// Three volumes the player sets in the sound panel (0..1, in steps of 10 %), plus a
// "mute everything" switch (M key). All remembered in the browser.
//   music: menu music and the match background tracks
//   crowd: chants, the goal shout and the "uuuh" (the stadium atmosphere)
//   sfx:   every synthesized effect (kicks, bounces, buttons...)
export const CHANNELS = ['music', 'crowd', 'sfx'];
const AUDIO_KEY = 'tejo-futbol-audio';
const OLD_VOLUME_KEY = 'tejo-futbol-volume'; // the single volume of earlier versions
const settings = loadAudio();
const volumeListeners = new Set();

function loadAudio() {
  const defaults = { music: 1, crowd: 1, sfx: 1, muted: false };
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO_KEY));
    if (saved) {
      for (const ch of CHANNELS) if (typeof saved[ch] === 'number') defaults[ch] = clamp01(saved[ch]);
      defaults.muted = !!saved.muted;
      return defaults;
    }
    // Earlier versions had one volume: alto 1, medio 0.5, mudo 0. Keep what was chosen.
    const old = localStorage.getItem(OLD_VOLUME_KEY);
    if (old !== null) {
      const v = Number(old);
      if (v === 0) defaults.muted = true;
      else if (v > 0 && v <= 1) for (const ch of CHANNELS) defaults[ch] = v;
    }
  } catch {
    // Private mode or a broken value: start from the defaults.
  }
  return defaults;
}

function saveAudio() {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(settings));
  } catch {
    // Private mode: the levels just aren't remembered.
  }
  volumeListeners.forEach((fn) => fn());
}

function clamp01(v) {
  return Math.round(Math.min(1, Math.max(0, v)) * 10) / 10;
}

// The level the player chose for a channel (ignores mute), 0..1.
export function getChannel(ch) {
  return settings[ch];
}

export function setChannel(ch, value) {
  settings[ch] = clamp01(value);
  saveAudio();
}

// What a channel actually plays at right now (0 while muted).
export function channelVolume(ch) {
  return settings.muted ? 0 : settings[ch];
}

export function isMuted() {
  return settings.muted;
}

export function setMuted(muted) {
  settings.muted = muted;
  saveAudio();
}

export function toggleMute() {
  setMuted(!settings.muted);
}

// For the speaker icons: 0 (muted or everything at 0), 0.5 (low) or 1.
export function iconLevel() {
  const loudest = settings.muted ? 0 : Math.max(...CHANNELS.map((ch) => settings[ch]));
  if (loudest === 0) return 0;
  return loudest < 0.5 ? 0.5 : 1;
}

// Calls fn() on every change. Returns a function that stops listening.
export function onVolumeChange(fn) {
  volumeListeners.add(fn);
  return () => volumeListeners.delete(fn);
}

// Browsers only allow audio after a user gesture; call this from a key/click handler.
export function unlockAudio() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    // Every effect goes through a boost and then a limiter, so they're loud enough over
    // the music but don't distort when several play at once.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    bus = ctx.createGain();
    bus.gain.value = AUDIO.sfxBoost;
    bus.connect(limiter).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, duration, { type = 'square', volume = 0.12, slideTo = null, delay = 0 } = {}) {
  const level = channelVolume('sfx');
  if (!ctx || ctx.state !== 'running' || level === 0) return;
  volume *= level;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(bus);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sfx = {
  // Pitch rises with ball speed (ratio 0..1) so fast rallies sound more intense.
  wall: (ratio = 0) => tone(260 + ratio * 500, 0.05, { volume: 0.06 }),
  body: () => tone(150, 0.09, { type: 'triangle', volume: 0.2 }),
  kick: () => tone(620, 0.11, { type: 'sawtooth', volume: 0.1, slideTo: 200 }),
  // Menus: moving between options, accepting one, and going back / leaving.
  select: () => tone(880, 0.06, { type: 'triangle', volume: 0.12 }),
  confirm: () => [660, 990].forEach((f, i) => tone(f, 0.1, { type: 'triangle', volume: 0.15, delay: i * 0.06 })),
  back: () => [620, 410].forEach((f, i) => tone(f, 0.1, { type: 'triangle', volume: 0.14, slideTo: f * 0.85, delay: i * 0.07 })),
  // Quiet under the recorded goal shout (music.js).
  goal: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', volume: 0.07, delay: i * 0.09 })),
  tick: () => tone(1200, 0.05, { type: 'square', volume: 0.08 }),
  // Referee whistle: two short trills and a long one.
  whistle: () => [0, 0.22, 0.44].forEach((delay, i) => tone(2600, i === 2 ? 0.55 : 0.16, { type: 'sine', volume: 0.12, slideTo: 2350, delay })),
  win: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'square', volume: 0.09, delay: i * 0.13 })),
  countdown: () => tone(660, 0.14, { type: 'triangle', volume: 0.16 }),
  go: () => tone(2600, 0.3, { type: 'sine', volume: 0.12, slideTo: 2400 }), // short whistle
  // Metallic "clang" for the post: a few inharmonic partials.
  post: () => [[620, 0.35], [1250, 0.3], [1870, 0.25]].forEach(([f, d]) => tone(f, d, { type: 'triangle', volume: 0.09 })),
  spawn: () => [520, 780].forEach((f, i) => tone(f, 0.09, { type: 'triangle', volume: 0.08, delay: i * 0.06 })),
  // Icy crackle: fast falling high notes.
  freeze: () => [2400, 1900, 1500, 1100].forEach((f, i) => tone(f, 0.12, { type: 'square', volume: 0.05, delay: i * 0.04 })),
  // Bubbles: quick rising blips.
  soap: () => [300, 420, 360, 520, 460].forEach((f, i) => tone(f, 0.07, { type: 'sine', volume: 0.12, slideTo: f * 1.8, delay: i * 0.05 })),
  dash: () => tone(900, 0.2, { type: 'sawtooth', volume: 0.08, slideTo: 180 }),
  dashReady: () => [880, 1320].forEach((f, i) => tone(f, 0.1, { type: 'triangle', volume: 0.08, delay: i * 0.08 })),
  // The ball breaks a power-up: glassy cracks for the ice, quick pops for the soap.
  crack: () => [3200, 2500, 4100, 2900, 3600].forEach((f, i) => tone(f, 0.07, { type: 'square', volume: 0.06, slideTo: f * 0.6, delay: i * 0.025 })),
  splash: () => [600, 900, 1300].forEach((f, i) => tone(f, 0.08, { type: 'sine', volume: 0.16, slideTo: f * 2.2, delay: i * 0.035 })),
  fire: () => tone(220, 0.35, { type: 'sawtooth', volume: 0.07, slideTo: 880 }),
};
