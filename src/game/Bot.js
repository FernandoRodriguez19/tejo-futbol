import {
  FIELD, MID_Y, CENTER_X, MOUTH_L, MOUTH_R,
  PLAYER_R, BALL_R, KICK, BOT_LEVELS,
} from '../config.js';

const REACH = PLAYER_R + BALL_R;
const KEEPER_Y = FIELD.top + PLAYER_R + 40; // where the bot stands to save shots
const DETOUR = REACH + 30; // sideways gap kept when walking around the ball
const DASH_FROM = 170; // distance to its target from which the bot dashes

// Drives the top (red) player. It attacks the bottom goal and defends the top one.
// Golden rule: the bot must stay "goal side" of the ball (between the ball and its own
// goal) and never push the ball upward with its body, or it scores own goals.
export default class Bot {
  // `level` is a BOT_LEVELS key or a settings object (league teams build their own).
  constructor(player, ball, opponent, level) {
    this.player = player;
    this.ball = ball;
    this.opponent = opponent;
    this.cfg = typeof level === 'string' ? BOT_LEVELS[level] : level;
    this.target = { x: player.x, y: player.y };
    this.wantsKick = false;
    this.nextThink = 0;
  }

  // Returns the movement direction (-1..1 per axis, scaled by the level speed) and whether to kick.
  update(time) {
    if (time >= this.nextThink) {
      this.think();
      this.nextThink = time + this.cfg.reaction;
    }

    const { player, ball } = this;
    const dx = this.target.x - player.x;
    const dy = this.target.y - player.y;
    const dist = Math.hypot(dx, dy);
    // Slow down near the target so the bot doesn't jitter around it.
    const throttle = Math.min(1, dist / 20) * this.cfg.speed;
    const move = dist < 2 ? { x: 0, y: 0 } : { x: (dx / dist) * throttle, y: (dy / dist) * throttle };

    // Safety net, checked every frame: if the ball is just above us (toward our goal),
    // never walk up into it; step sideways instead.
    const bx = ball.x - player.x;
    const by = ball.y - player.y;
    const ballDist = Math.hypot(bx, by);
    if (by < 0 && ballDist < REACH + 20 && move.y < 0) {
      move.y = 0;
      move.x = (bx > 0 ? -1 : 1) * this.cfg.speed;
    }

    // Only kick when the shot goes downward, toward the opponent's goal.
    const inReach = ballDist <= REACH + KICK.reach;
    const kick = this.wantsKick && inReach && by / (ballDist || 1) > 0.15;
    if (kick) this.wantsKick = false;

    // Dash (used only when the bar is full) when the spot it needs to reach is far and
    // the play is on its side or coming at it: to get back in goal or reach the ball.
    const dash = dist > DASH_FROM && (ball.vy < 0 || ball.y < MID_Y);

    return { move, kick, dash };
  }

  think() {
    const { ball, player, cfg } = this;
    const jitter = () => (Math.random() * 2 - 1) * cfg.error;

    this.wantsKick = Math.random() < cfg.kickChance;

    let dest;
    if (ball.y < player.y - 4 && ball.y < KEEPER_Y + REACH) {
      // Ball got behind us, next to our goal line. Touching it from here would knock it
      // in, so block the near post if it's in a corner, or else just stay out of its way.
      const inFrontOfGoal = ball.x > MOUTH_L - BALL_R && ball.x < MOUTH_R + BALL_R;
      if (inFrontOfGoal) {
        dest = { x: player.x, y: player.y };
      } else {
        const postX = ball.x < CENTER_X ? MOUTH_L + PLAYER_R - 6 : MOUTH_R - PLAYER_R + 6;
        dest = { x: postX, y: FIELD.top + PLAYER_R };
      }
    } else if (ball.vy < -40 && ball.y > KEEPER_Y + REACH * 0.5) {
      // Ball coming at our goal: act as a goalkeeper on the line it will cross.
      const x = clamp(this.predictX(KEEPER_Y) + jitter(), MOUTH_L - 30, MOUTH_R + 30);
      dest = { x, y: KEEPER_Y };
    } else if (ball.y < MID_Y + BALL_R) {
      // Ball on our side and not a threat: attack it from behind, aiming at the bottom goal.
      let aimX = CENTER_X;
      if (cfg.predict === 'bounces') {
        // Aim at the side of the goal the opponent is not covering.
        aimX = this.opponent.x < CENTER_X ? MOUTH_R - 25 : MOUTH_L + 25;
      }
      const ax = aimX - ball.x;
      const ay = FIELD.bottom - ball.y;
      const len = Math.hypot(ax, ay) || 1;
      dest = { x: ball.x - (ax / len) * (REACH - 6), y: ball.y - (ay / len) * (REACH - 6) };
    } else {
      // Ball on the other side: wait in front of our goal, leaning toward the ball.
      dest = { x: CENTER_X + (ball.x - CENTER_X) * 0.4 + jitter(), y: FIELD.top + 150 };
    }

    this.target = this.avoidBall(dest);
    this.target.x = clamp(this.target.x, FIELD.left + PLAYER_R, FIELD.right - PLAYER_R);
    this.target.y = clamp(this.target.y, FIELD.top + PLAYER_R, MID_Y - PLAYER_R);
  }

  // If we're on the wrong side of the ball (below it), walk around it instead of
  // straight through it, which would push it into our own goal.
  avoidBall(dest) {
    const { player, ball } = this;
    const wrongSide = player.y > ball.y - REACH * 0.6;
    const destAboveBall = dest.y < ball.y - REACH * 0.3;
    if (!wrongSide || !destAboveBall) return dest;

    // Go around on our side of the ball, unless the wall leaves no room there.
    let side = Math.sign(player.x - ball.x) || (ball.x < CENTER_X ? 1 : -1);
    const sideX = ball.x + side * DETOUR;
    if (sideX < FIELD.left + PLAYER_R || sideX > FIELD.right - PLAYER_R) side = -side;

    if (Math.abs(player.x - ball.x) < DETOUR - 6) {
      // Too close to the ball's column: first step sideways.
      return { x: ball.x + side * DETOUR, y: player.y };
    }
    // Clear of it: now walk up past the ball.
    return { x: ball.x + side * DETOUR, y: ball.y - REACH };
  }

  // Where the ball will cross the horizontal line y = lineY.
  predictX(lineY) {
    const { ball, cfg } = this;
    if (cfg.predict === 'none' || ball.vy >= 0) return ball.x;

    const t = (lineY - ball.y) / ball.vy;
    const raw = ball.x + ball.vx * t;
    const minX = FIELD.left + BALL_R;
    const maxX = FIELD.right - BALL_R;
    if (cfg.predict === 'straight') return clamp(raw, minX, maxX);

    // Unfold the side-wall bounces.
    const width = maxX - minX;
    let rel = (raw - minX) % (2 * width);
    if (rel < 0) rel += 2 * width;
    return minX + (rel > width ? 2 * width - rel : rel);
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
