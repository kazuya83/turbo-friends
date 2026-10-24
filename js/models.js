// カート・キャラ・アイテムの3Dモデル（すべて図形の組み合わせで作るオリジナル）
import * as THREE from 'three';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function lighten(hex, k) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), k);
  return c;
}

export function buildKartMesh(ch) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const main = new THREE.MeshStandardMaterial({ color: ch.color, roughness: 0.4, metalness: 0.15 });
  const dark = lambert(0x24262c);
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  add(new THREE.BoxGeometry(2.0, 0.45, 3.0), main, 0, 0.55, 0);
  add(new THREE.BoxGeometry(1.5, 0.35, 0.9), main, 0, 0.5, 1.75);
  add(new THREE.BoxGeometry(2.3, 0.3, 0.35), dark, 0, 0.4, 2.2);
  add(new THREE.BoxGeometry(2.4, 0.14, 0.55), main, 0, 1.3, -1.45);
  add(new THREE.BoxGeometry(0.12, 0.6, 0.2), dark, 0.8, 1.0, -1.45);
  add(new THREE.BoxGeometry(0.12, 0.6, 0.2), dark, -0.8, 1.0, -1.45);
  add(new THREE.BoxGeometry(1.1, 0.8, 0.3), dark, 0, 1.05, -0.65);
  add(new THREE.BoxGeometry(0.9, 0.12, 0.9), lambert(0xdddddd), 0, 0.85, 0.85); // ハンドル台
  const wheel = add(new THREE.TorusGeometry(0.35, 0.06, 6, 14), dark, 0, 1.25, 0.55);
  wheel.rotation.x = -0.9;

  const wheels = [];
  const wg = new THREE.CylinderGeometry(0.48, 0.48, 0.5, 14);
  wg.rotateZ(Math.PI / 2);
  const hub = lambert(0xcccccc);
  for (const [x, z] of [[1.15, 1.1], [-1.15, 1.1], [1.2, -1.05], [-1.2, -1.05]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.48, z);
    w.add(new THREE.Mesh(wg, dark));
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.3), hub);
    w.add(h);
    body.add(w); wheels.push(w);
  }

  // ドライバー
  const suit = lambert(lighten(ch.color, 0.25));
  add(new THREE.CylinderGeometry(0.36, 0.42, 0.75, 10), suit, 0, 1.3, -0.25);
  const head = new THREE.Group();
  head.position.set(0, 1.98, -0.2);
  body.add(head);
  add(new THREE.SphereGeometry(0.46, 16, 12), lambert(ch.skin), 0, 0, 0, head);
  const helmet = add(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), main, 0, 0.05, -0.04, head);
  helmet.rotation.x = -0.25;
  const eye = lambert(0x1b1b1b);
  add(new THREE.SphereGeometry(0.07, 8, 6), eye, 0.16, 0.02, 0.42, head);
  add(new THREE.SphereGeometry(0.07, 8, 6), eye, -0.16, 0.02, 0.42, head);
  add(new THREE.SphereGeometry(0.06, 8, 6), lambert(0xff8a8a), 0.27, -0.12, 0.36, head);
  add(new THREE.SphereGeometry(0.06, 8, 6), lambert(0xff8a8a), -0.27, -0.12, 0.36, head);
  accessory(head, ch, main);

  // 影
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.9, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.06; shadow.scale.set(0.8, 1.15, 1);
  g.add(shadow);

  // ブーストの炎
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 10),
    new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.85 }));
  flame.rotation.x = -Math.PI / 2; flame.position.set(0, 0.6, -2.3);
  flame.visible = false;
  body.add(flame);

  // ドリフトの火花
  const sparks = [];
  for (const x of [1.15, -1.15]) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0x4fc3ff }));
    sp.position.set(x, 0.25, -1.5); sp.visible = false;
    body.add(sp); sparks.push(sp);
  }

  // バリア
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.25, depthWrite: false }));
  shield.position.y = 1.1; shield.visible = false;
  g.add(shield);

  g.userData = { body, wheels, flame, sparks, shield };
  return g;
}

function accessory(head, ch, main) {
  const c = lambert(ch.color);
  const m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); head.add(o); return o; };
  switch (ch.acc) {
    case 'antenna': {
      m(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), lambert(0x999999), 0, 0.75, -0.05);
      m(new THREE.SphereGeometry(0.14, 10, 8), lambert(0xffe14d, { emissive: 0x665500 }), 0, 1.1, -0.05);
      break;
    }
    case 'ears': {
      for (const s of [-1, 1]) {
        const e = m(new THREE.ConeGeometry(0.18, 0.5, 8), c, s * 0.3, 0.6, 0);
        e.rotation.z = -s * 0.35;
        const inner = m(new THREE.ConeGeometry(0.1, 0.32, 8), lambert(0xffc0c0), s * 0.3, 0.58, 0.07);
        inner.rotation.z = -s * 0.35;
      }
      break;
    }
    case 'bow': {
      const bm = lambert(0xffffff);
      for (const s of [-1, 1]) {
        const b = m(new THREE.ConeGeometry(0.2, 0.42, 4), bm, s * 0.24, 0.55, -0.15);
        b.rotation.z = s * Math.PI / 2;
      }
      m(new THREE.SphereGeometry(0.1, 8, 6), bm, 0, 0.55, -0.15);
      break;
    }
    case 'horns': {
      for (const s of [-1, 1]) {
        const h = m(new THREE.ConeGeometry(0.12, 0.5, 8), lambert(0xf5f0e0), s * 0.38, 0.45, 0);
        h.rotation.z = -s * 0.7;
      }
      break;
    }
    case 'leaf': {
      m(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), lambert(0x6b4a2b), 0, 0.62, 0);
      const l = m(new THREE.SphereGeometry(0.2, 10, 6), lambert(0x7ee081), 0.15, 0.78, 0);
      l.scale.set(1.4, 0.35, 0.8); l.rotation.z = 0.4;
      break;
    }
    case 'mohawk': {
      for (let i = 0; i < 4; i++) {
        const f = m(new THREE.ConeGeometry(0.11, 0.4, 6), lambert(0xffd84a), 0, 0.6 - i * 0.03, 0.18 - i * 0.16);
        f.rotation.x = -0.3 - i * 0.15;
      }
      break;
    }
  }
}

export function makeNameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = Math.min(250, x.measureText(text).width + 30);
  x.fillStyle = 'rgba(0,0,0,0.55)';
  x.beginPath(); x.roundRect((256 - w) / 2, 6, w, 52, 18); x.fill();
  x.fillStyle = '#' + new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5).getHexString();
  x.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(4.2, 1.05, 1); s.position.y = 3.6; s.renderOrder = 10;
  return s;
}

export function buildCrystal() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0),
    new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x3a7cff, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.88, flatShading: true }));
  m.position.y = 1.6;
  g.add(m);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.08, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  ring.position.y = 1.6; ring.rotation.x = Math.PI / 2;
  g.add(ring);
  g.userData.gem = m; g.userData.ring = ring;
  return g;
}

export function buildEntityMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'slime') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: 0x6fdc4a, roughness: 0.15, transparent: true, opacity: 0.9 }));
    b.scale.set(1.3, 0.55, 1.3); b.position.y = 0.4; g.add(b);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lambert(0x111111));
      e.position.set(s * 0.35, 0.75, 0.9); g.add(e);
    }
  } else if (kind === 'bomb') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshStandardMaterial({ color: 0x23233a, roughness: 0.3, metalness: 0.4 }));
    b.position.y = 0.9; g.add(b);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 6, 20), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
    band.position.y = 0.9; band.rotation.x = Math.PI / 2; g.add(band);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd84a }));
    f.position.y = 1.9; g.add(f);
    g.userData.spin = b;
  } else if (kind === 'seeker') {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.45 : 1.1, a = i / 10 * Math.PI * 2 + Math.PI / 2;
      i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
    geo.center();
    const st = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    st.position.y = 1.4; g.add(st);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.25, depthWrite: false }));
    glow.position.y = 1.4; g.add(glow);
    g.userData.spin = st;
  }
  return g;
}

export function buildPad() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#ff7a1a'; x.fillRect(0, 0, 64, 128);
  x.fillStyle = '#fff3b0';
  for (let i = 0; i < 3; i++) {
    const y = 20 + i * 36;
    x.beginPath(); x.moveTo(8, y + 22); x.lineTo(32, y); x.lineTo(56, y + 22); x.lineTo(56, y + 34); x.lineTo(32, y + 12); x.lineTo(8, y + 34); x.closePath(); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 6), new THREE.MeshBasicMaterial({ map: t }));
  m.rotation.x = -Math.PI / 2;
  // テクスチャの上方向を進行方向に合わせる
  m.rotation.z = Math.PI;
  m.position.y = 0.06;
  const g = new THREE.Group(); g.add(m);
  return g;
}

export function buildBurst(color) {
  return new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
}
