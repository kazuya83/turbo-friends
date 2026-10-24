// コースの形・当たり判定・見た目を作る
import * as THREE from 'three';

const N = 800;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Track {
  constructor(def) {
    this.def = def;
    this.hw = def.width / 2;
    this.N = N;
    const curve = new THREE.CatmullRomCurve3(def.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    const pts = curve.getSpacedPoints(N);
    this.length = curve.getLength();
    this.segLen = this.length / N;
    this.px = new Float32Array(N); this.pz = new Float32Array(N);
    this.tx = new Float32Array(N); this.tz = new Float32Array(N);
    this.nx = new Float32Array(N); this.nz = new Float32Array(N);
    for (let i = 0; i < N; i++) { this.px[i] = pts[i].x; this.pz[i] = pts[i].z; }
    for (let i = 0; i < N; i++) {
      const a = (i + N - 1) % N, b = (i + 1) % N;
      let dx = this.px[b] - this.px[a], dz = this.pz[b] - this.pz[a];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      this.tx[i] = dx; this.tz[i] = dz;
      // 進行方向の左側を正とする
      this.nx[i] = dz; this.nz[i] = -dx;
    }
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < N; i++) {
      minX = Math.min(minX, this.px[i]); maxX = Math.max(maxX, this.px[i]);
      minZ = Math.min(minZ, this.pz[i]); maxZ = Math.max(maxZ, this.pz[i]);
    }
    this.bounds = { minX, maxX, minZ, maxZ };
  }

  heading(i) { return Math.atan2(this.tx[i], this.tz[i]); }

  nearest(x, z, hint = -1) {
    let best = 0, bd = Infinity;
    if (hint < 0) {
      for (let i = 0; i < N; i++) {
        const d = (x - this.px[i]) ** 2 + (z - this.pz[i]) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    } else {
      for (let o = -40; o <= 40; o++) {
        const i = (hint + o + N) % N;
        const d = (x - this.px[i]) ** 2 + (z - this.pz[i]) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    }
    return best;
  }

  lateral(x, z, i) { return (x - this.px[i]) * this.nx[i] + (z - this.pz[i]) * this.nz[i]; }

  distToTrack(x, z) {
    let bd = Infinity;
    for (let i = 0; i < N; i += 4) bd = Math.min(bd, (x - this.px[i]) ** 2 + (z - this.pz[i]) ** 2);
    return Math.sqrt(bd);
  }

  // 中心線からの横オフセット offA〜offB の帯を作る
  ribbon(offA, offB, yA, yB, vLen) {
    const pos = [], uv = [], idx = [];
    for (let k = 0; k <= N; k++) {
      const i = k % N;
      pos.push(this.px[i] + this.nx[i] * offA, yA, this.pz[i] + this.nz[i] * offA);
      pos.push(this.px[i] + this.nx[i] * offB, yB, this.pz[i] + this.nz[i] * offB);
      const v = k * this.segLen / vLen;
      uv.push(0, v, 1, v);
      if (k < N) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  build() {
    const g = new THREE.Group();
    const th = this.def.theme;
    const hw = this.hw;

    // 地面：色ムラのある草・砂・アスファルトの質感
    const groundTex = canvasTex(256, 256, (c, w, h) => {
      const base = new THREE.Color(th.ground);
      c.fillStyle = '#' + base.getHexString(); c.fillRect(0, 0, w, h);
      const r = rng(11);
      for (let i = 0; i < 2600; i++) {
        const k = 0.75 + r() * 0.5;
        const col = base.clone().multiplyScalar(k);
        c.fillStyle = `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},0.55)`;
        const s = 1 + r() * 3;
        c.fillRect(r() * w, r() * h, s, s * (th.night ? 1 : 2));
      }
    });
    groundTex.repeat.set(400, 400);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: groundTex, roughness: 1, metalness: 0 }));
    ground.userData.noCast = true;
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
    g.add(ground);

    const roadTex = canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = th.night ? '#2c2f3d' : '#555b66'; c.fillRect(0, 0, w, h);
      const r = rng(7);
      for (let i = 0; i < 900; i++) {
        const v = 70 + r() * 40 | 0;
        c.fillStyle = `rgba(${v},${v},${v + 8},0.35)`;
        c.fillRect(r() * w, r() * h, 2, 2);
      }
      c.fillStyle = th.night ? '#ffd84a' : '#f4f4f4';
      c.fillRect(w / 2 - 2, 0, 4, h / 2);
    });
    const road = new THREE.Mesh(this.ribbon(-hw, hw, 0.02, 0.02, 14),
      new THREE.MeshStandardMaterial({ map: roadTex, bumpMap: roadTex, bumpScale: 0.6, roughness: th.night ? 0.55 : 0.85, metalness: 0, side: THREE.DoubleSide }));
    road.userData.noCast = true;
    g.add(road);

    const curbTex = canvasTex(4, 64, (c, w, h) => {
      c.fillStyle = th.night ? '#ff2bd6' : '#e0443e'; c.fillRect(0, 0, w, h / 2);
      c.fillStyle = th.night ? '#22e6ff' : '#ffffff'; c.fillRect(0, h / 2, w, h / 2);
    });
    const curbMat = th.night
      ? new THREE.MeshBasicMaterial({ map: curbTex, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ map: curbTex, side: THREE.DoubleSide });
    for (const [a, b] of [[hw, hw + 1.4], [-hw - 1.4, -hw]]) {
      const curb = new THREE.Mesh(this.ribbon(a, b, 0.04, 0.04, 5), curbMat);
      curb.userData.noCast = true; g.add(curb);
    }

    // 外側の壁
    const wallOff = hw + 8;
    const wallMat = new THREE.MeshStandardMaterial({ color: th.wall, roughness: 0.8, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(this.ribbon(wallOff, wallOff, 0, 1.4, 10), wallMat));
    g.add(new THREE.Mesh(this.ribbon(-wallOff, -wallOff, 0, 1.4, 10), wallMat));
    if (th.night) {
      const neonA = new THREE.MeshBasicMaterial({ color: 0x22e6ff, side: THREE.DoubleSide });
      const neonB = new THREE.MeshBasicMaterial({ color: 0xff2bd6, side: THREE.DoubleSide });
      g.add(new THREE.Mesh(this.ribbon(wallOff - 0.01, wallOff - 0.01, 1.25, 1.5, 10), neonA));
      g.add(new THREE.Mesh(this.ribbon(-wallOff + 0.01, -wallOff + 0.01, 1.25, 1.5, 10), neonB));
    }

    // スタートライン
    const checker = canvasTex(64, 16, (c, w, h) => {
      for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) {
        c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 4, y * 4, 4, 4);
      }
    }, false);
    checker.magFilter = THREE.NearestFilter;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 3), new THREE.MeshLambertMaterial({ map: checker }));
    line.rotation.x = -Math.PI / 2; line.position.y = 0.05;
    const arch = this.startArch();
    arch.add(line);
    g.add(arch);

    this.decorate(g);
    return g;
  }

  startArch() {
    const g = new THREE.Group();
    const th = this.def.theme;
    const hw = this.hw;
    const postMat = new THREE.MeshLambertMaterial({ color: th.night ? 0x444a77 : 0xffffff });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 9, 12), postMat);
      p.position.set(s * (hw + 3), 4.5, 0); g.add(p);
    }
    const tex = canvasTex(512, 64, (c, w, h) => {
      c.fillStyle = '#ff7a1a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('TURBO FRIENDS', w / 2, h / 2 + 2);
    }, false);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 8, 2.4, 0.6),
      [postMat, postMat, postMat, postMat, new THREE.MeshBasicMaterial({ map: tex }), new THREE.MeshBasicMaterial({ map: tex })]);
    banner.position.y = 8.5; g.add(banner);
    g.position.set(this.px[0], 0, this.pz[0]);
    g.rotation.y = this.heading(0);
    return g;
  }

  // コースから離れたランダムな位置
  scatter(r, count, minDist, maxDist) {
    const out = [];
    const b = this.bounds, pad = maxDist;
    let tries = 0;
    while (out.length < count && tries++ < count * 40) {
      const x = b.minX - pad + r() * (b.maxX - b.minX + pad * 2);
      const z = b.minZ - pad + r() * (b.maxZ - b.minZ + pad * 2);
      const d = this.distToTrack(x, z);
      if (d > minDist && d < maxDist) out.push([x, z]);
    }
    return out;
  }

  decorate(g) {
    const r = rng(this.def.id.length * 977 + 13);
    const hw = this.hw;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const inst = (geo, mat, list, f) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((pt, i) => {
        const o = f(pt, i);
        p.set(o.x, o.y, o.z); s.set(o.sx, o.sy, o.sz); q.setFromAxisAngle(up, o.ry || 0);
        m4.compose(p, q, s); im.setMatrixAt(i, m4);
        if (o.color !== undefined) im.setColorAt(i, new THREE.Color(o.color));
      });
      g.add(im);
      return im;
    };

    if (this.def.deco === 'meadow') {
      const trees = this.scatter(r, 220, hw + 14, 260);
      const sc = trees.map(() => 0.8 + r() * 0.9);
      inst(new THREE.CylinderGeometry(0.5, 0.7, 4, 6), new THREE.MeshLambertMaterial({ color: 0x8a5a2b }), trees,
        ([x, z], i) => ({ x, y: 2 * sc[i], z, sx: sc[i], sy: sc[i], sz: sc[i] }));
      const greens = [0x2f9e44, 0x37b24d, 0x40c057, 0x2b8a3e];
      inst(new THREE.ConeGeometry(3, 7, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }), trees,
        ([x, z], i) => ({ x, y: (4 + 3.5) * sc[i], z, sx: sc[i], sy: sc[i], sz: sc[i], color: greens[i % 4] }));
      const hills = this.scatter(r, 14, 120, 520);
      inst(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshLambertMaterial({ color: 0x4caf50 }), hills,
        ([x, z]) => { const k = 40 + r() * 60; return { x, y: -k * 0.3, z, sx: k, sy: k * 0.6, sz: k }; });
      const flowers = this.scatter(r, 300, hw + 9, 60);
      const fc = [0xffffff, 0xffe066, 0xff8fab, 0xb197fc];
      inst(new THREE.SphereGeometry(0.45, 6, 4), new THREE.MeshLambertMaterial({ color: 0xffffff }), flowers,
        ([x, z], i) => ({ x, y: 0.3, z, sx: 1, sy: 1, sz: 1, color: fc[i % 4] }));
      this.clouds(g, r);
    } else if (this.def.deco === 'desert') {
      const cacti = this.scatter(r, 120, hw + 14, 220);
      const sc = cacti.map(() => 0.8 + r() * 0.8);
      const cmat = new THREE.MeshLambertMaterial({ color: 0x3f9d4a });
      inst(new THREE.CylinderGeometry(0.8, 0.9, 7, 8), cmat, cacti,
        ([x, z], i) => ({ x, y: 3.5 * sc[i], z, sx: sc[i], sy: sc[i], sz: sc[i] }));
      inst(new THREE.CylinderGeometry(0.5, 0.5, 3, 8), cmat, cacti,
        ([x, z], i) => ({ x: x + 1.3 * sc[i], y: 4.5 * sc[i], z, sx: sc[i], sy: sc[i], sz: sc[i] }));
      const rocks = this.scatter(r, 70, hw + 12, 200);
      inst(new THREE.DodecahedronGeometry(1.6, 0), new THREE.MeshLambertMaterial({ color: 0xb5793f }), rocks,
        ([x, z]) => { const k = 0.6 + r() * 1.6; return { x, y: 0.6 * k, z, sx: k, sy: k * 0.7, sz: k, ry: r() * 6 }; });
      const dunes = this.scatter(r, 18, 70, 520);
      inst(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshLambertMaterial({ color: 0xf0cf8a }), dunes,
        ([x, z]) => { const k = 30 + r() * 50; return { x, y: -k * 0.35, z, sx: k * 1.4, sy: k * 0.5, sz: k }; });
      const pyr = this.scatter(r, 4, 200, 480);
      inst(new THREE.ConeGeometry(1, 1, 4), new THREE.MeshLambertMaterial({ color: 0xe2b464 }), pyr,
        ([x, z]) => { const k = 50 + r() * 40; return { x, y: k * 0.4, z, sx: k, sy: k * 0.8, sz: k, ry: r() }; });
      const sun = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1b8, fog: false }));
      sun.position.set(400, 260, -500); g.add(sun);
    } else if (this.def.deco === 'city') {
      const winTex = canvasTex(64, 128, (c, w, h) => {
        c.fillStyle = '#151830'; c.fillRect(0, 0, w, h);
        const rr = rng(3);
        for (let y = 4; y < h - 4; y += 8) for (let x = 4; x < w - 4; x += 8) {
          const v = rr();
          c.fillStyle = v < 0.45 ? '#ffd76a' : v < 0.55 ? '#7fe3ff' : '#20243f';
          c.fillRect(x, y, 4, 5);
        }
      });
      const bmat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.9 });
      const blds = this.scatter(r, 170, hw + 18, 230);
      const tint = [0xffffff, 0xd0d8ff, 0xffd8f0, 0xd8fff4];
      inst(new THREE.BoxGeometry(1, 1, 1), bmat, blds, ([x, z], i) => {
        const w = 10 + r() * 14, h = 15 + r() * 60;
        return { x, y: h / 2, z, sx: w, sy: h, sz: w * (0.7 + r() * 0.6), ry: r() * 3, color: tint[i % 4] };
      });
      // 街灯
      const lamps = [];
      for (let i = 0; i < this.N; i += 24) {
        const sd = (i / 24) % 2 ? 1 : -1;
        lamps.push([this.px[i] + this.nx[i] * sd * (hw + 4), this.pz[i] + this.nz[i] * sd * (hw + 4)]);
      }
      inst(new THREE.CylinderGeometry(0.2, 0.25, 7, 6), new THREE.MeshLambertMaterial({ color: 0x555a80 }), lamps,
        ([x, z]) => ({ x, y: 3.5, z, sx: 1, sy: 1, sz: 1 }));
      inst(new THREE.SphereGeometry(0.7, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), lamps,
        ([x, z]) => ({ x, y: 7.2, z, sx: 1, sy: 1, sz: 1 }));
      // 星と月
      const sp = [];
      for (let i = 0; i < 600; i++) {
        const a = r() * Math.PI * 2, e = 0.15 + r() * 1.2, R = 900;
        sp.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R);
      }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, sizeAttenuation: false, fog: false })));
      const moon = new THREE.Mesh(new THREE.SphereGeometry(28, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false }));
      moon.position.set(-420, 300, -500); g.add(moon);
    }
  }

  clouds(g, r) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x666666, fog: false });
    const geo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const m = new THREE.Mesh(geo, mat);
        const k = 10 + r() * 10;
        m.scale.set(k * 1.6, k, k);
        m.position.set(j * 14 - 20, r() * 4, r() * 8);
        c.add(m);
      }
      const a = r() * Math.PI * 2, d = 350 + r() * 250;
      c.position.set(Math.cos(a) * d, 110 + r() * 60, Math.sin(a) * d);
      g.add(c);
    }
  }
}
