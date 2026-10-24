// カート・キャラ・アイテムの3Dモデル（すべて図形の組み合わせで作るオリジナル）
import * as THREE from 'three';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

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

  // モンスター（運転手）
  const head = new THREE.Group();
  head.position.set(0, 1.55, -0.25);
  body.add(head);
  const skin = lambert(ch.body);
  const blob = add(new THREE.SphereGeometry(0.72, 20, 16), skin, 0, 0, 0, head);
  blob.scale.set(1, 0.92, 0.95);
  const white = lambert(0xffffff), eye = lambert(0x1b1b1b);
  for (const s of [-1, 1]) {
    const w = add(new THREE.SphereGeometry(0.2, 12, 10), white, s * 0.25, 0.12, 0.58, head);
    w.scale.set(1, 1.15, 0.6);
    add(new THREE.SphereGeometry(0.11, 10, 8), eye, s * 0.25, 0.12, 0.7, head);
    add(new THREE.SphereGeometry(0.04, 6, 4), white, s * 0.25 + 0.04, 0.17, 0.79, head);
    // 小さな手
    add(new THREE.SphereGeometry(0.16, 8, 6), skin, s * 0.45, -0.38, 0.55, head);
  }
  const mouth = add(new THREE.TorusGeometry(0.1, 0.03, 6, 12, Math.PI), eye, 0, -0.12, 0.66, head);
  mouth.rotation.z = Math.PI;
  accessory(head, ch);

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

function accessory(head, ch) {
  const m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); head.add(o); return o; };
  switch (ch.acc) {
    case 'bolt': { // ギザギザの角2本
      const mat = lambert(0xffe14d, { emissive: 0x554400 });
      for (const s of [-1, 1]) {
        const a1 = m(new THREE.BoxGeometry(0.12, 0.35, 0.12), mat, s * 0.32, 0.72, 0);
        a1.rotation.z = -s * 0.5;
        const a2 = m(new THREE.BoxGeometry(0.12, 0.35, 0.12), mat, s * 0.38, 0.98, 0);
        a2.rotation.z = s * 0.5;
      }
      break;
    }
    case 'wings': { // 雲のもこもこと小さな羽
      const mat = lambert(0xffffff);
      for (const [x, y, z, r] of [[0, 0.62, 0, 0.3], [0.3, 0.5, -0.1, 0.25], [-0.3, 0.5, -0.1, 0.25]]) m(new THREE.SphereGeometry(r, 10, 8), mat, x, y, z);
      for (const s of [-1, 1]) {
        const w = m(new THREE.SphereGeometry(0.3, 10, 6), lambert(0xbfe6ff), s * 0.8, 0.15, -0.15);
        w.scale.set(0.35, 0.9, 0.6); w.rotation.z = -s * 0.6;
      }
      break;
    }
    case 'fin': { // しずくのとがった頭とヒレ
      const mat = lambert(0x4aa8ff);
      const tip = m(new THREE.ConeGeometry(0.42, 0.8, 16), mat, 0, 0.85, -0.05);
      tip.rotation.x = -0.25;
      for (const s of [-1, 1]) {
        const f = m(new THREE.ConeGeometry(0.16, 0.5, 8), lambert(0xaee3ff), s * 0.75, 0.1, -0.1);
        f.rotation.z = s * 1.3;
      }
      break;
    }
    case 'rock': { // ゴツゴツの岩
      const mat = lambert(0x6f655d, { flatShading: true });
      for (const [x, y, z] of [[0, 0.68, -0.05], [0.4, 0.5, -0.2], [-0.42, 0.48, -0.15], [0.15, 0.4, -0.55], [-0.2, 0.3, -0.6]]) {
        const r = m(new THREE.DodecahedronGeometry(0.22, 0), mat, x, y, z);
        r.rotation.set(x * 3, y * 4, z * 2);
      }
      break;
    }
    case 'sprout': { // 頭の芽と葉っぱの耳
      m(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6), lambert(0x3f8f2f), 0, 0.85, 0);
      const leafMat = lambert(0x4fc94a);
      for (const s of [-1, 1]) {
        const l = m(new THREE.SphereGeometry(0.2, 10, 6), leafMat, s * 0.18, 1.05, 0);
        l.scale.set(1.4, 0.3, 0.8); l.rotation.z = s * 0.5;
        const ear = m(new THREE.SphereGeometry(0.25, 10, 6), leafMat, s * 0.62, 0.45, -0.05);
        ear.scale.set(0.35, 1, 0.7); ear.rotation.z = -s * 0.7;
      }
      break;
    }
    case 'flame': { // メラメラの炎
      const fm = [0xffd84a, 0xff9a2e, 0xff4d3d];
      for (let i = 0; i < 3; i++) {
        const f = m(new THREE.ConeGeometry(0.32 - i * 0.07, 0.75 - i * 0.12, 10),
          new THREE.MeshBasicMaterial({ color: fm[i] }), (i - 1) * 0.22, 0.85 + (i === 1 ? 0.12 : 0), -0.1 - i * 0.03);
        f.rotation.z = (1 - i) * 0.3;
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
