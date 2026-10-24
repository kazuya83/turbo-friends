// カートの動き（物理）とCPUの運転
import { statsOf } from './data.js';

export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export const NO_INPUT = { up: false, down: false, steer: 0, drift: false, driftPressed: false, item: false };
const DRIFT_BOOST = [0, 0.6, 1.1, 1.6];

export class Kart {
  constructor({ id, name, char, cpu, controlled }) {
    this.id = id; this.name = name; this.char = char; this.cpu = !!cpu;
    this.controlled = controlled;
    this.stats = statsOf(char);
    this.maxMul = 1;
    this.x = 0; this.z = 0; this.h = 0; this.speed = 0;
    this.idx = -1; this.lat = 0; this.lap = 0; this.checkpoint = true; this.prog = 0;
    this.spinT = 0; this.spinAngle = 0; this.stallT = 0; this.boostT = 0; this.shieldT = 0;
    this.drifting = false; this.driftDir = 0; this.driftCharge = 0; this.hopT = 0;
    this.item = null; this.itemCount = 0; this.rouletteT = 0; this.pendingItem = null;
    this.finished = false; this.finishTime = 0;
    this.padCool = 0;
    this.ai = { lane: 0, laneTarget: 0, laneT: 0, itemT: 0, stuckT: 0, reverseT: 0 };
    this.net = null;
    this.onBoost = null; this.onLap = null;
  }

  place(track, slot) {
    const N = track.N;
    const row = Math.floor(slot / 2), col = slot % 2;
    const i = (N - 8 - row * 7 - col * 3) % N;
    const lat = col === 0 ? 4.5 : -4.5;
    this.x = track.px[i] + track.nx[i] * lat;
    this.z = track.pz[i] + track.nz[i] * lat;
    this.h = track.heading(i);
    this.idx = -1;
    this.updateProgress(track);
  }

  driftLevel() {
    if (!this.drifting) return 0;
    return this.driftCharge >= 3.4 ? 3 : this.driftCharge >= 2.0 ? 2 : this.driftCharge >= 1.0 ? 1 : 0;
  }

  boost(t) {
    this.boostT = Math.max(this.boostT, t);
    this.onBoost?.(this);
  }

  releaseDrift() {
    const lv = this.driftLevel();
    this.drifting = false; this.driftCharge = 0;
    if (lv > 0) this.boost(DRIFT_BOOST[lv]);
  }

  update(dt, inp, track) {
    const st = this.stats;
    if (this.spinT > 0) {
      this.spinT -= dt;
      this.spinAngle += dt * 13;
      this.speed *= Math.max(0, 1 - 2.4 * dt);
      inp = NO_INPUT;
      this.drifting = false; this.driftCharge = 0;
    } else this.spinAngle = 0;
    if (this.stallT > 0) { this.stallT -= dt; inp = { ...inp, up: false }; }
    if (this.shieldT > 0) this.shieldT -= dt;
    if (this.padCool > 0) this.padCool -= dt;

    const off = Math.abs(this.lat) > track.hw + 0.8;
    const smax = st.max * this.maxMul;
    let max = smax * (off && this.boostT <= 0 ? 0.5 : 1);
    if (this.boostT > 0) {
      this.boostT -= dt;
      max = smax * 1.38;
      this.speed = Math.min(max, this.speed + 70 * dt);
    }
    if (inp.up) {
      if (this.speed < max) {
        const a = st.accel * (this.speed < 0 ? 2 : 1) * (1 - 0.55 * Math.max(0, this.speed) / max);
        this.speed = Math.min(max, this.speed + a * dt);
      }
    } else if (inp.down) {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - 35 * dt);
      else this.speed = Math.max(-11, this.speed - 14 * dt);
    } else {
      const f = Math.min(Math.abs(this.speed), (6 + Math.abs(this.speed) * 0.4) * dt);
      this.speed -= Math.sign(this.speed) * f;
    }
    if (this.speed > max) this.speed = Math.max(max, this.speed - (off ? 45 : 18) * dt);

    const s = inp.steer;
    const spd = Math.abs(this.speed);
    const grip = Math.min(1, spd / 10);
    if (this.drifting) {
      if (!inp.drift || spd < 12) this.releaseDrift();
      else {
        const amt = this.driftDir * (0.55 + 0.5 * s * this.driftDir);
        this.h += amt * st.turn * 1.25 * dt * grip;
        this.driftCharge += dt * (0.7 + 0.6 * Math.max(0, s * this.driftDir)) * (off ? 0.3 : 1);
      }
    }
    if (!this.drifting) {
      if (inp.driftPressed && s !== 0 && spd > 14 && this.hopT <= 0) {
        this.drifting = true; this.driftDir = Math.sign(s); this.driftCharge = 0; this.hopT = 0.25;
      } else {
        this.h += s * st.turn * dt * grip * (this.speed < 0 ? -1 : 1) * (1 - 0.25 * spd / st.max);
      }
    }
    if (this.hopT > 0) this.hopT -= dt;

    const moveH = this.h - (this.drifting ? this.driftDir * 0.22 : 0);
    this.x += Math.sin(moveH) * this.speed * dt;
    this.z += Math.cos(moveH) * this.speed * dt;

    this.updateProgress(track);
    const lim = track.hw + 7;
    if (Math.abs(this.lat) > lim) {
      const push = (Math.abs(this.lat) - lim) * Math.sign(this.lat);
      this.x -= track.nx[this.idx] * push;
      this.z -= track.nz[this.idx] * push;
      this.lat = lim * Math.sign(this.lat);
      if (this.speed > 8) this.speed *= 1 - 3.5 * dt;
    }
  }

  updateProgress(track) {
    const N = track.N;
    const prev = this.idx;
    const i = track.nearest(this.x, this.z, prev);
    const dx = this.x - track.px[i], dz = this.z - track.pz[i];
    this.lat = dx * track.nx[i] + dz * track.nz[i];
    const along = dx * track.tx[i] + dz * track.tz[i];
    if (prev >= 0) {
      if (prev > N * 0.85 && i < N * 0.15) {
        if (this.checkpoint) { this.lap++; this.checkpoint = false; this.onLap?.(this); }
      } else if (prev < N * 0.15 && i > N * 0.85) {
        this.lap--; this.checkpoint = true;
      }
    }
    if (i > N * 0.4 && i < N * 0.6) this.checkpoint = true;
    this.idx = i;
    this.prog = this.lap * N + i + Math.max(-0.5, Math.min(0.5, along / track.segLen));
  }
}

// CPUの運転
export function aiInput(k, track, dt) {
  const ai = k.ai;
  ai.laneT -= dt;
  if (ai.laneT <= 0) {
    ai.laneT = 2 + Math.random() * 3;
    ai.laneTarget = (Math.random() * 2 - 1) * track.hw * 0.55;
  }
  ai.lane += (ai.laneTarget - ai.lane) * Math.min(1, dt * 0.8);
  if (ai.reverseT > 0) {
    ai.reverseT -= dt;
    return { ...NO_INPUT, down: true, steer: -Math.sign(k.lat || 1) };
  }
  if (k.speed < 2 && k.spinT <= 0 && k.stallT <= 0) {
    ai.stuckT += dt;
    if (ai.stuckT > 1.5) { ai.stuckT = 0; ai.reverseT = 1.0; }
  } else ai.stuckT = 0;

  const look = Math.floor(10 + Math.max(0, k.speed) * 0.35);
  const j = (k.idx + look) % track.N;
  const tx = track.px[j] + track.nx[j] * ai.lane, tz = track.pz[j] + track.nz[j] * ai.lane;
  const diff = wrapAngle(Math.atan2(tx - k.x, tz - k.z) - k.h);
  const steer = Math.max(-1, Math.min(1, diff * 3));
  return {
    up: !(Math.abs(diff) > 0.8 && k.speed > 22),
    down: Math.abs(diff) > 1.2 && k.speed > 15,
    steer, drift: false, driftPressed: false, item: false,
  };
}
