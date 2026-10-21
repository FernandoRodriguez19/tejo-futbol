// Lightweight particle system: plain objects drawn into one Graphics every frame,
// instead of one game object per particle.
const MAX_PARTICLES = 600;

const rand = (range) => (Array.isArray(range) ? range[0] + Math.random() * (range[1] - range[0]) : range);

export default class Particles {
  constructor(scene, depth, blendMode) {
    this.g = scene.add.graphics().setDepth(depth);
    if (blendMode !== undefined) this.g.setBlendMode(blendMode);
    this.list = [];
  }

  // angle and spread in degrees; colors: one colour, or a list the particle goes through
  // over its life (e.g. yellow -> orange -> red for fire).
  emit(x, y, {
    count = 1, speed = [20, 80], angle = 0, spread = 360, life = [300, 600], size = [3, 6],
    colors = [0xffffff], shape = 'circle', grow = 0, drag = 0, alpha = 1, gradient = false,
  } = {}) {
    for (let i = 0; i < count; i++) {
      const a = ((angle + (Math.random() - 0.5) * spread) * Math.PI) / 180;
      const v = rand(speed);
      const max = rand(life);
      this.list.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: max, max, size: rand(size), grow, drag, alpha, shape, gradient,
        colors, color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 12,
      });
    }
    if (this.list.length > MAX_PARTICLES) this.list.splice(0, this.list.length - MAX_PARTICLES);
  }

  update(dt) {
    const g = this.g;
    g.clear();
    const alive = [];
    for (const p of this.list) {
      p.life -= dt * 1000;
      if (p.life <= 0) continue;
      alive.push(p);
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      const t = 1 - p.life / p.max;
      const size = Math.max(0.5, p.size * (1 + p.grow * t));
      const color = p.gradient ? p.colors[Math.min(p.colors.length - 1, Math.floor(t * p.colors.length))] : p.color;
      g.fillStyle(color, p.alpha * (1 - t));
      if (p.shape === 'rect') {
        const c = Math.cos(p.rot);
        const s = Math.sin(p.rot);
        const hw = size;
        const hh = size * 0.45;
        g.fillPoints([
          { x: p.x + c * hw - s * hh, y: p.y + s * hw + c * hh },
          { x: p.x - c * hw - s * hh, y: p.y - s * hw + c * hh },
          { x: p.x - c * hw + s * hh, y: p.y - s * hw - c * hh },
          { x: p.x + c * hw + s * hh, y: p.y + s * hw - c * hh },
        ], true);
      } else {
        g.fillCircle(p.x, p.y, size);
      }
    }
    this.list = alive;
  }
}
