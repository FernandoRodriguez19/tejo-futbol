// Records the last few seconds of a match so goals can be replayed in slow motion.
export default class Replay {
  constructor(keepMs = 3000) {
    this.keepMs = keepMs;
    this.frames = [];
  }

  clear() {
    this.frames.length = 0;
  }

  record(t, ball, p1, p2) {
    this.frames.push({
      t,
      bx: ball.x, by: ball.y, bvx: ball.vx, bvy: ball.vy,
      p1x: p1.x, p1y: p1.y, p1k: p1.kickHeld,
      p2x: p2.x, p2y: p2.y, p2k: p2.kickHeld,
    });
    while (this.frames.length && this.frames[0].t < t - this.keepMs) this.frames.shift();
  }

  // The last `ms` of recorded play, with times rebased to start at 0.
  clip(ms) {
    if (!this.frames.length) return [];
    const end = this.frames[this.frames.length - 1].t;
    const start = end - ms;
    return this.frames.filter((f) => f.t >= start).map((f) => ({ ...f, t: f.t - start }));
  }
}
