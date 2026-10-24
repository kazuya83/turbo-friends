// カート・キャラ・アイテムの3Dモデル（すべて図形の組み合わせで作るオリジナル）
import * as THREE from 'three';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function lighten(hex, k) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), k);
  return c;
}

// ---------- 質感（肌・布・髪・毛皮・タイヤ） ----------
const bumps = {};
function bumpTex(kind) {
  if (bumps[kind]) return bumps[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, 128, 128);
  let s = kind.length * 99;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  if (kind === 'fabric') {
    for (let y = 0; y < 128; y += 2) { x.fillStyle = y % 4 ? '#707070' : '#909090'; x.fillRect(0, y, 128, 1); }
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${0},0,0)`; }
    for (let i = 0; i < 600; i++) { const v = 100 + r() * 60 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(r() * 128, r() * 128, 1, 1); }
  } else if (kind === 'hair' || kind === 'fur') {
    const n = kind === 'hair' ? 900 : 1400;
    for (let i = 0; i < n; i++) {
      const v = r() * 255 | 0; x.strokeStyle = `rgba(${v},${v},${v},0.6)`;
      const px = r() * 128, py = r() * 128, len = kind === 'hair' ? 10 + r() * 14 : 3 + r() * 5;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 3, py + len); x.stroke();
    }
  } else if (kind === 'skin') {
    for (let i = 0; i < 900; i++) { const v = 115 + r() * 30 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(r() * 128, r() * 128, 2, 2); }
  } else if (kind === 'tread') {
    for (let y = 0; y < 128; y += 16) { x.fillStyle = '#202020'; x.fillRect(0, y, 128, 6); }
    for (let y = 8; y < 128; y += 16) for (let xx = 0; xx < 128; xx += 32) { x.fillStyle = '#303030'; x.fillRect(xx, y, 14, 8); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (kind === 'fur') t.repeat.set(3, 3);
  bumps[kind] = t;
  return t;
}
const M = {
  skin: (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, sheen: 0.5, sheenColor: 0xffb8a0, sheenRoughness: 0.6, bumpMap: bumpTex('skin'), bumpScale: 0.15 }),
  fabric: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, bumpMap: bumpTex('fabric'), bumpScale: 0.5 }),
  hair: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, bumpMap: bumpTex('hair'), bumpScale: 1.2 }),
  fur: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, bumpMap: bumpTex('fur'), bumpScale: 1.6 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.85, bumpMap: bumpTex('tread'), bumpScale: 1.5 }),
  chrome: () => new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.18, metalness: 1 }),
  plastic: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }),
  glossy: (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
};

// 目：白目・虹彩・瞳・ハイライト
function makeEye(parent, x, y, z, r, iris = 0x5a3a22, opts = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const white = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), M.glossy(0xf8f6f2));
  g.add(white);
  const ir = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 14, 10), M.glossy(iris));
  ir.scale.z = 0.4; ir.position.z = r * 0.78; g.add(ir);
  const pu = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 12, 8), M.glossy(0x050505));
  pu.scale.z = 0.4; pu.position.z = r * 0.9; g.add(pu);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  hl.position.set(r * 0.25, r * 0.28, r * 0.98); g.add(hl);
  if (opts.lid !== undefined) { // まぶた（0=全開 1=閉じる）
    const lid = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 16, 10, 0, Math.PI * 2, 0, Math.PI * (0.25 + opts.lid * 0.3)), opts.lidMat);
    lid.rotation.x = -0.35; g.add(lid);
  }
  return g;
}

export function buildKartMesh(ch) {
  if (ch.animal) return buildAnimal(ch);
  return ch.runner ? buildRunner(ch) : buildKart(ch);
}

function commonParts(g, body, ch, opts) {
  // 影（軽量画質用の丸い影）
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.9, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.06; shadow.scale.set(opts.shadowX, 1.15, 1);
  shadow.userData.blobShadow = true;
  g.add(shadow);
  // ブーストの炎
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 10),
    new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.85 }));
  flame.rotation.x = -Math.PI / 2; flame.position.set(0, opts.flameY, opts.flameZ);
  flame.visible = false;
  body.add(flame);
  // ドリフトの火花
  const sparks = [];
  for (const x of opts.sparkX) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0x4fc3ff }));
    sp.position.set(x, 0.25, opts.sparkZ); sp.visible = false;
    body.add(sp); sparks.push(sp);
  }
  // バリア
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.25, depthWrite: false }));
  shield.position.y = 1.2; shield.visible = false;
  g.add(shield);
  return { flame, sparks, shield };
}

// 横から見たカートの形を押し出して、角の丸いボディを作る
function kartBodyGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-1.5, 0.3);
  s.lineTo(1.6, 0.3);
  s.quadraticCurveTo(2.25, 0.32, 2.2, 0.55);
  s.lineTo(1.2, 0.72);
  s.quadraticCurveTo(0.6, 0.95, 0.2, 0.8);
  s.lineTo(-0.9, 0.8);
  s.quadraticCurveTo(-1.5, 0.85, -1.55, 0.6);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 4, curveSegments: 10 });
  geo.translate(0, 0, -0.75);
  geo.rotateY(-Math.PI / 2); // 押し出し方向を横幅に、形の向きを前(+z)に合わせる
  return geo;
}

function buildKart(ch) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color: ch.color, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06 });
  const dark = M.plastic(0x222428), chrome = M.chrome();
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  add(kartBodyGeometry(), paint, 0, 0, 0);
  add(new THREE.BoxGeometry(2.4, 0.22, 0.4), dark, 0, 0.42, 2.25);                 // 前バンパー
  const wing = add(new THREE.BoxGeometry(2.4, 0.08, 0.6), paint, 0, 1.4, -1.55);   // リアウイング
  wing.rotation.x = -0.12;
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.08, 0.55, 0.3), dark, s * 1.05, 1.12, -1.55);
    const pipe = add(new THREE.CylinderGeometry(0.11, 0.13, 0.7, 12), chrome, s * 0.45, 0.75, -1.85); // マフラー
    pipe.rotation.x = Math.PI / 2 - 0.25;
    const lamp = add(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xfff2c0, emissiveIntensity: 1.2 }), s * 0.6, 0.62, 2.16);
    lamp.scale.z = 0.4;
  }
  const seat = add(new THREE.BoxGeometry(1.0, 0.85, 0.3), M.fabric(0x2a2a30), 0, 1.15, -0.75);
  seat.rotation.x = -0.15;
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), chrome, 0, 1.1, 0.75).rotation.x = -0.9; // ハンドル軸
  const wheel = add(new THREE.TorusGeometry(0.32, 0.055, 8, 20), M.plastic(0x18181b), 0, 1.33, 0.52);
  wheel.rotation.x = -0.9;

  const wheels = [];
  const tyre = new THREE.CylinderGeometry(0.5, 0.5, 0.52, 22); tyre.rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.3, 0.3, 0.54, 16); rim.rotateZ(Math.PI / 2);
  const rubber = M.rubber();
  for (const [x, z] of [[1.15, 1.25], [-1.15, 1.25], [1.22, -1.1], [-1.22, -1.1]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.5, z);
    w.add(new THREE.Mesh(tyre, rubber));
    w.add(new THREE.Mesh(rim, chrome));
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.5), dark); w.add(spoke);
    body.add(w); wheels.push(w);
  }

  // ドライバー（レーシングスーツ）
  const suit = M.fabric(lighten(ch.color, 0.35));
  const torso = add(new THREE.CapsuleGeometry(0.36, 0.45, 6, 12), suit, 0, 1.45, -0.42);
  torso.rotation.x = -0.2;
  const anims = [];
  const head = buildHead(ch, anims);
  head.position.set(0, 2.2, -0.3); head.scale.setScalar(1.15);
  body.add(head);
  for (const s of [-1, 1]) {
    const arm = add(new THREE.CapsuleGeometry(0.11, 0.55, 4, 8), suit, s * 0.36, 1.48, 0.05);
    arm.rotation.x = 1.15; arm.rotation.z = s * 0.2;
    add(new THREE.SphereGeometry(0.12, 10, 8), M.plastic(0x222222), s * 0.27, 1.36, 0.48); // 手袋
  }

  const c = commonParts(g, body, ch, { shadowX: 0.8, flameY: 0.75, flameZ: -2.3, sparkX: [1.15, -1.15], sparkZ: -1.5 });
  g.userData = { body, wheels, legs: [], arms: [], anims, ...c };
  return g;
}

function buildRunner(ch) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shirt = M.fabric(ch.color);
  const skin = M.skin(ch.skin);
  const pants = M.fabric(ch.pants || 0x2d3a8c);
  const shoe = M.plastic(ch.shoe || 0xff4d3d);
  const sole = M.plastic(0xf2f2f2);
  const muscle = ch.quirk === 'muscle', skinny = ch.quirk === 'skinny';
  const bw = muscle ? 1.25 : skinny ? 0.72 : 1.0;

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38 * bw, 0.55, 6, 14), shirt);
  torso.scale.z = 0.75; torso.position.y = 1.85; body.add(torso);
  if (muscle) { // 胸板と肩
    for (const s of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), shirt);
      pec.position.set(s * 0.2, 2.05, 0.2); pec.scale.set(1, 0.8, 0.6); body.add(pec);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
      sh.position.set(s * 0.58, 2.25, 0); body.add(sh);
    }
  }
  if (ch.quirk === 'auntie') { // エプロン
    const ap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.04), M.fabric(0xffffff));
    ap.position.set(0, 1.62, 0.31); body.add(ap);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * bw, 0.15 * bw, 0.25, 10), skin);
  neck.position.y = 2.5; body.add(neck);
  const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.33 * bw, 0.1, 4, 12), pants);
  hips.scale.z = 0.8; hips.position.y = 1.22; body.add(hips);

  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.2 * bw, 1.15, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.13 * bw, 0.38, 4, 10), skinny ? skin : pants);
    thigh.position.y = -0.28; leg.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.55; leg.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.11 * bw, 0.36, 4, 10), skin);
    shin.position.y = -0.24; knee.add(shin);
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.25, 4, 10), shoe);
    foot.rotation.x = Math.PI / 2; foot.position.set(0, -0.5, 0.1); knee.add(foot);
    const so = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.48), sole);
    so.position.set(0, -0.6, 0.1); knee.add(so);
    leg.userData.knee = knee;
    body.add(leg); legs.push(leg);

    const arm = new THREE.Group(); arm.position.set(s * (0.45 * bw + 0.1), 2.25, 0);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(muscle ? 0.17 : 0.09, 0.32, 4, 8), muscle ? skin : shirt);
    up.position.y = -0.22; arm.add(up);
    const elbow = new THREE.Group(); elbow.position.y = -0.45; elbow.rotation.x = -1.2; arm.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(muscle ? 0.14 : 0.08, 0.3, 4, 8), skin);
    fore.position.y = -0.2; elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(muscle ? 0.15 : 0.1, 10, 8), skin);
    hand.position.y = -0.42; elbow.add(hand);
    if (ch.quirk === 'auntie' && s === 1) { // 買い物ぶくろ
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.25), M.fabric(0xffd84a));
      bag.position.y = -0.7; elbow.add(bag);
      const leek = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), M.plastic(0x6fdc4a));
      leek.position.set(0.08, -0.4, 0); elbow.add(leek);
    }
    body.add(arm); arms.push(arm);
  }

  const anims = [];
  const head = buildHead(ch, anims);
  head.position.set(0, 2.98, 0.02); head.scale.setScalar(1.05);
  body.add(head);

  const c = commonParts(g, body, ch, { shadowX: 0.55, flameY: 1.6, flameZ: -0.9, sparkX: [0.35, -0.35], sparkZ: -0.3 });
  g.userData = { body, wheels: [], legs, arms, anims, runner: true, ...c };
  return g;
}

// 頭とクセ（鼻水・はげ・アフロ…）
function buildHead(ch, anims) {
  const head = new THREE.Group();
  const m = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); head.add(o); return o; };
  const skinMat = ch.quirk === 'bald'
    ? new THREE.MeshPhysicalMaterial({ color: ch.skin, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.1, sheen: 0.4, sheenColor: 0xffb8a0 })
    : M.skin(ch.skin);
  const skull = m(new THREE.SphereGeometry(0.46, 28, 22), skinMat, 0, 0, 0);
  skull.scale.set(0.92, 1.05, 0.96);
  const jaw = m(new THREE.SphereGeometry(0.34, 20, 16), skinMat, 0, -0.2, 0.08);
  jaw.scale.set(1, 0.8, 1);
  const hair = M.hair(ch.hair);
  const lipMat = M.skin(new THREE.Color(ch.skin).lerp(new THREE.Color(0xc0505a), 0.45));
  const darker = new THREE.Color(ch.skin).multiplyScalar(0.9);
  for (const s of [-1, 1]) { // 耳
    const ear = m(new THREE.SphereGeometry(0.11, 12, 10), M.skin(darker), s * 0.43, -0.02, -0.02);
    ear.scale.set(0.45, 1, 0.75);
  }
  const eyes = (lid) => {
    for (const s of [-1, 1]) makeEye(head, s * 0.16, 0.05, 0.36, 0.085, ch.iris || 0x5a3a22,
      lid !== undefined ? { lid, lidMat: skinMat } : {});
  };
  const brows = (tilt = 0.1, thick = 0.045) => {
    for (const s of [-1, 1]) { const b = m(new THREE.CapsuleGeometry(thick, 0.12, 4, 8), hair, s * 0.16, 0.18, 0.4); b.rotation.z = Math.PI / 2 + s * tilt; }
  };
  const nose = (size = 1) => {
    const n = m(new THREE.CapsuleGeometry(0.05 * size, 0.08 * size, 4, 8), M.skin(darker), 0, -0.04, 0.45);
    n.rotation.x = -0.4;
    m(new THREE.SphereGeometry(0.065 * size, 10, 8), M.skin(darker), 0, -0.1, 0.47);
  };
  const mouth = (wide = 1) => {
    const lip = m(new THREE.TorusGeometry(0.07 * wide, 0.022, 6, 16, Math.PI), lipMat, 0, -0.24, 0.39);
    lip.rotation.z = Math.PI;
  };

  switch (ch.quirk) {
    case 'snot': { // ボサボサ頭と、たれる鼻水
      eyes(); brows(-0.15); nose(); mouth(0.8);
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * Math.PI * 2;
        const sp = m(new THREE.ConeGeometry(0.11, 0.42, 8), hair, Math.cos(a) * 0.24, 0.4, Math.sin(a) * 0.24 - 0.06);
        sp.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
      }
      m(new THREE.SphereGeometry(0.44, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), hair, 0, 0.08, -0.03);
      const snotMat = new THREE.MeshPhysicalMaterial({ color: 0x9be86a, roughness: 0.05, transmission: 0.3, clearcoat: 1, transparent: true, opacity: 0.92 });
      const drip = new THREE.Group(); drip.position.set(0.05, -0.15, 0.49); head.add(drip);
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1, 8), snotMat);
      line.position.y = -0.5; drip.add(line);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), snotMat);
      ball.position.y = -1; drip.add(ball);
      anims.push({ type: 'drip', obj: drip });
      break;
    }
    case 'bald': { // ツルツル頭、横だけ髪、メガネ、ヒゲ
      for (const s of [-1, 1]) {
        const h = m(new THREE.SphereGeometry(0.17, 12, 10), hair, s * 0.38, 0.02, -0.12); h.scale.set(0.55, 1, 1.5);
        const lens = m(new THREE.TorusGeometry(0.11, 0.018, 8, 20), M.chrome(), s * 0.16, 0.05, 0.45);
        lens.rotation.y = s * 0.1;
        const glass = m(new THREE.CircleGeometry(0.105, 20), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: 0.9, transparent: true, opacity: 0.25 }), s * 0.16, 0.05, 0.455);
        glass.userData.noCast = true;
      }
      m(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), M.chrome(), 0, 0.06, 0.46).rotation.z = Math.PI / 2;
      eyes(); brows(0.05); nose(1.2);
      const stache = m(new THREE.CapsuleGeometry(0.05, 0.25, 4, 10), hair, 0, -0.17, 0.43);
      stache.rotation.z = Math.PI / 2;
      mouth();
      const shine = m(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.12, 0.4, 0.2);
      anims.push({ type: 'shine', obj: shine });
      break;
    }
    case 'sleepy': { // 閉じかけの目、ナイトキャップ、鼻ちょうちん
      eyes(0.95); brows(0.25, 0.035); nose(); mouth(0.7);
      const cap = m(new THREE.ConeGeometry(0.44, 0.95, 20), M.fabric(0x6f9cff), -0.05, 0.52, -0.05);
      cap.rotation.z = 0.55;
      m(new THREE.TorusGeometry(0.42, 0.06, 8, 24), M.fabric(0xffffff), 0, 0.2, -0.03).rotation.x = Math.PI / 2;
      m(new THREE.SphereGeometry(0.12, 10, 8), M.fur(0xffffff), -0.44, 0.8, -0.05);
      const bub = m(new THREE.SphereGeometry(0.12, 16, 12),
        new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, roughness: 0, transmission: 0.8, transparent: true, opacity: 0.5, iridescence: 1 }), 0.1, -0.12, 0.55);
      anims.push({ type: 'bubble', obj: bub });
      break;
    }
    case 'afro': { // 巨大アフロとサングラス
      for (let i = 0; i < 22; i++) {
        const a = i / 22 * Math.PI * 2 * 2.3, y = 0.25 + (i / 22) * 0.55;
        const rr = 0.48 - (i / 22) * 0.15;
        m(new THREE.SphereGeometry(0.3, 12, 10), hair, Math.cos(a) * rr, y, Math.sin(a) * rr - 0.1);
      }
      m(new THREE.SphereGeometry(0.52, 16, 12), hair, 0, 0.62, -0.1);
      for (const s of [-1, 1]) m(new THREE.BoxGeometry(0.2, 0.11, 0.05), M.glossy(0x111111), s * 0.13, 0.06, 0.45);
      m(new THREE.BoxGeometry(0.06, 0.03, 0.04), M.chrome(), 0, 0.07, 0.46);
      brows(-0.2); nose(1.1);
      m(new THREE.BoxGeometry(0.18, 0.04, 0.04), lipMat, 0.03, -0.24, 0.4).rotation.z = 0.15;
      break;
    }
    case 'oldman': { // 白いヒゲ、太いまゆ毛、てっぺんハゲ
      eyes(0.5); nose(1.3);
      for (const s of [-1, 1]) {
        const brow = m(new THREE.CapsuleGeometry(0.06, 0.14, 4, 8), hair, s * 0.17, 0.19, 0.4);
        brow.rotation.z = Math.PI / 2 - s * 0.3;
        const side = m(new THREE.SphereGeometry(0.18, 12, 10), hair, s * 0.37, 0.05, -0.15); side.scale.set(0.55, 1, 1.4);
      }
      const beard = m(new THREE.SphereGeometry(0.3, 16, 12), hair, 0, -0.34, 0.22);
      beard.scale.set(1.05, 1.35, 0.7);
      m(new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), hair, 0, -0.17, 0.43).rotation.z = Math.PI / 2;
      anims.push({ type: 'beard', obj: beard });
      for (let i = 0; i < 5; i++) { // しわ
        const w = m(new THREE.TorusGeometry(0.18, 0.006, 4, 16, Math.PI * 0.6), M.skin(darker), 0, 0.28 + i * 0.03, 0.36 - i * 0.03);
        w.rotation.set(-0.5, 0, Math.PI * 1.2);
      }
      break;
    }
    case 'buckteeth': { // おかっぱ頭と出っ歯
      const bowl = m(new THREE.SphereGeometry(0.5, 24, 14, 0, Math.PI * 2, 0, Math.PI / 1.9), hair, 0, 0.05, -0.02);
      bowl.rotation.x = -0.12;
      eyes(); brows(0); nose();
      mouth(1.1);
      for (const s of [-1, 1]) m(new THREE.BoxGeometry(0.085, 0.15, 0.05), M.glossy(0xfffbe8), s * 0.046, -0.27, 0.42);
      break;
    }
    case 'muscle': { // 角刈り・汗
      const top = m(new THREE.BoxGeometry(0.76, 0.2, 0.76), hair, 0, 0.36, -0.03);
      top.geometry = new THREE.CapsuleGeometry(0.36, 0.05, 4, 12); top.scale.set(1.05, 0.35, 1.05); top.position.y = 0.38;
      brows(-0.3, 0.05); eyes(0.3); nose(1.2);
      m(new THREE.BoxGeometry(0.22, 0.05, 0.04), M.glossy(0xffffff), 0, -0.24, 0.4);
      const chin = m(new THREE.SphereGeometry(0.16, 12, 10), skinMat, 0, -0.33, 0.25); chin.scale.set(1.3, 0.8, 0.8);
      const sweat = m(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, roughness: 0, transmission: 0.7, transparent: true, opacity: 0.8 }), 0.4, 0.2, 0.22);
      anims.push({ type: 'sweat', obj: sweat });
      break;
    }
    case 'skinny': { // ハチマキとこけた頬
      const band = m(new THREE.CylinderGeometry(0.455, 0.455, 0.11, 24, 1, true), M.fabric(0xffffff), 0, 0.2, 0);
      band.material.side = THREE.DoubleSide;
      m(new THREE.SphereGeometry(0.07, 10, 8), M.fabric(0xff3b3b), 0, 0.2, 0.45);
      const tail = m(new THREE.BoxGeometry(0.06, 0.08, 0.5), M.fabric(0xffffff), 0.1, 0.18, -0.65);
      anims.push({ type: 'flutter', obj: tail });
      m(new THREE.SphereGeometry(0.45, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3.2), hair, 0, 0.06, -0.06);
      eyes(); brows(0.1, 0.03); nose(); mouth(0.9);
      break;
    }
    case 'auntie': { // パーマとカーラー、赤い口紅
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI * 2;
        m(new THREE.SphereGeometry(0.19, 12, 10), hair, Math.cos(a) * 0.36, 0.28 + Math.sin(i * 1.7) * 0.06, Math.sin(a) * 0.34 - 0.1);
      }
      m(new THREE.SphereGeometry(0.4, 16, 10), hair, 0, 0.35, -0.12);
      for (const [x, z] of [[-0.2, 0.1], [0.2, 0.05], [0, -0.25]]) {
        const cu = m(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 12), M.plastic(0xff8fab), x, 0.62, z);
        cu.rotation.z = Math.PI / 2;
      }
      eyes(); brows(0.15, 0.03); nose();
      const lips = m(new THREE.SphereGeometry(0.08, 12, 8), M.glossy(0xe0203a), 0, -0.24, 0.39);
      lips.scale.set(1.3, 0.45, 0.6);
      for (const s of [-1, 1]) m(new THREE.SphereGeometry(0.04, 8, 6), M.chrome(), s * 0.44, -0.12, 0); // イヤリング
      break;
    }
    default: eyes(); brows(); nose(); mouth();
  }
  // ほっぺ
  for (const s of [-1, 1]) {
    const ch2 = m(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff9a9a, roughness: 0.6, transparent: true, opacity: 0.5 }), s * 0.26, -0.1, 0.34);
    ch2.scale.z = 0.4;
  }
  return head;
}

// 犬・猫・恐竜（4本足または2本足で走る）
function buildAnimal(ch) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = M.fur(ch.color), sub = M.fur(ch.sub), black = M.glossy(0x111111), white = M.glossy(0xfaf8f0);
  const add = (geo, mat, x, y, z, parent = body) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); parent.add(o); return o; };
  const legs = [], arms = [], anims = [];
  const legPhase = [];
  const kind = ch.animal;

  if (kind === 'dino') {
    const torso = add(new THREE.SphereGeometry(0.9, 28, 20), fur, 0, 1.9, -0.1);
    torso.scale.set(0.9, 1.0, 1.3); torso.rotation.x = -0.35;
    add(new THREE.SphereGeometry(0.62, 14, 10), sub, 0, 1.75, 0.45).scale.set(0.9, 1.1, 0.6);
    const head = new THREE.Group(); head.position.set(0, 3.0, 0.75); body.add(head);
    add(new THREE.CapsuleGeometry(0.4, 0.5, 6, 14), fur, 0, 0, 0.15, head).rotation.x = Math.PI / 2;
    const jaw = add(new THREE.CapsuleGeometry(0.28, 0.6, 6, 12), fur, 0, -0.36, 0.2, head);
    jaw.scale.set(1.3, 0.55, 1); jaw.rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.3, 12, 8), M.plastic(0xc0384a), 0, -0.22, 0.35, head).scale.set(1.1, 0.25, 1.4);
    for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.06, 0.16, 4), white, -0.3 + i * 0.2, -0.27, 0.68, head).rotation.x = Math.PI;
    for (const s of [-1, 1]) {
      makeEye(head, s * 0.32, 0.24, 0.4, 0.14, 0xe0a020);
      add(new THREE.SphereGeometry(0.04, 6, 4), black, s * 0.15, 0.12, 0.76, head);
    }
    anims.push({ type: 'jaw', obj: jaw });
    // 背中のトゲ
    for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.14, 0.35, 4), sub, 0, 2.75 - i * 0.28, 0.2 - i * 0.4);
    for (const s of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(s * 0.5, 1.5, -0.2);
      add(new THREE.CylinderGeometry(0.32, 0.2, 1.0, 10), fur, 0, -0.45, 0, leg);
      add(new THREE.BoxGeometry(0.4, 0.2, 0.65), fur, 0, -1.4, 0.15, leg);
      add(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 8), fur, 0, -1.1, 0, leg);
      body.add(leg); legs.push(leg); legPhase.push(s > 0 ? 0 : Math.PI);
      const arm = new THREE.Group(); arm.position.set(s * 0.55, 2.2, 0.55);
      add(new THREE.CylinderGeometry(0.07, 0.06, 0.4, 6), fur, 0, -0.18, 0.05, arm).rotation.x = 0.8;
      body.add(arm); arms.push(arm);
    }
    const tail = new THREE.Group(); tail.position.set(0, 1.7, -1.1); body.add(tail);
    add(new THREE.ConeGeometry(0.45, 2.0, 10), fur, 0, 0, -0.9, tail).rotation.x = -Math.PI / 2 - 0.2;
    anims.push({ type: 'tail', obj: tail, speed: 5, amp: 0.25 });
  } else {
    // 4本足（犬・猫）
    const cat = kind === 'cat';
    const torso = add(new THREE.SphereGeometry(0.7, 28, 20), fur, 0, 1.25, -0.1);
    torso.scale.set(cat ? 1.15 : 0.85, cat ? 0.95 : 0.8, 1.55);
    const belly = add(new THREE.SphereGeometry(0.5, 12, 10), sub, 0, 1.0, 0.0);
    belly.scale.set(cat ? 1.2 : 0.9, 0.6, 1.5);
    const head = new THREE.Group(); head.position.set(0, 2.0, 1.05); body.add(head);
    add(new THREE.SphereGeometry(0.55, 28, 20), fur, 0, 0, 0, head).scale.set(cat ? 1.1 : 1, 0.95, 1);
    add(new THREE.SphereGeometry(0.3, 12, 10), sub, 0, -0.15, 0.4, head).scale.set(1.1, 0.75, 0.9);
    add(new THREE.SphereGeometry(0.1, 14, 10), cat ? M.glossy(0xff8fab) : M.glossy(0x111111), 0, -0.02, 0.66, head).scale.set(1.3, 0.9, 0.9);
    for (const s of [-1, 1]) {
      if (cat) { // ふてくされた半目
        makeEye(head, s * 0.22, 0.12, 0.42, 0.13, 0xb8d83a, { lid: 0.85, lidMat: fur });
        const ear = add(new THREE.ConeGeometry(0.2, 0.4, 4), fur, s * 0.32, 0.55, -0.05, head);
        ear.rotation.z = -s * 0.25;
        for (const k of [-1, 1]) {
          const wh = add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), white, s * 0.38, -0.12 + k * 0.05, 0.45, head);
          wh.rotation.z = Math.PI / 2 + k * 0.15;
        }
      } else {
        makeEye(head, s * 0.2, 0.15, 0.44, 0.1, 0x4a2a12);
        const ear = add(new THREE.SphereGeometry(0.22, 10, 8), sub, s * 0.5, 0.05, -0.05, head);
        ear.scale.set(0.45, 1.3, 0.8);
        anims.push({ type: 'ear', obj: ear, side: s });
      }
    }
    if (!cat) { // ベロを出している
      const tongue = add(new THREE.CapsuleGeometry(0.08, 0.2, 4, 8), M.glossy(0xff6b8a), 0.05, -0.33, 0.6, head);
      tongue.scale.set(1, 0.3, 1);
      tongue.rotation.x = 0.7;
      anims.push({ type: 'tongue', obj: tongue });
    } else {
      // 太ったお腹のしま
      for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.72, 0.05, 4, 20, Math.PI), M.fur(ch.stripe), 0, 1.3, -0.5 + i * 0.35).rotation.y = Math.PI / 2;
    }
    const L = cat ? 0.55 : 0.75;
    const pos = [[0.35, 0.7], [-0.35, 0.7], [0.35, -0.75], [-0.35, -0.75]];
    pos.forEach(([x, z], i) => {
      const leg = new THREE.Group(); leg.position.set(x * (cat ? 1.2 : 1), 1.0, z);
      add(new THREE.CylinderGeometry(0.13, 0.11, L, 8), fur, 0, -L / 2, 0, leg);
      add(new THREE.SphereGeometry(0.16, 8, 6), sub, 0, -L - 0.05, 0.06, leg).scale.set(1, 0.7, 1.3);
      body.add(leg); legs.push(leg);
      legPhase.push(i === 0 || i === 3 ? 0 : Math.PI);
    });
    // 地面に足が届くよう全体を下げる
    body.position.y = 0;
    for (const l of legs) l.position.y = L + 0.1;
    torso.position.y = L + 0.45; belly.position.y = L + 0.25; head.position.y = L + 1.15;
    const tail = new THREE.Group(); tail.position.set(0, L + 0.6, -1.1); body.add(tail);
    const tl = add(new THREE.CylinderGeometry(0.07, 0.12, cat ? 1.1 : 0.7, 8), fur, 0, cat ? 0.5 : 0.3, 0, tail);
    tl.rotation.x = cat ? -0.2 : -0.7;
    anims.push({ type: 'tail', obj: tail, speed: cat ? 2 : 14, amp: cat ? 0.25 : 0.6 });
  }

  const c = commonParts(g, body, ch, { shadowX: kind === 'dino' ? 0.75 : 0.6, flameY: 1.3, flameZ: -1.8, sparkX: [0.4, -0.4], sparkZ: -0.8 });
  g.userData = { body, wheels: [], legs, arms, anims, legPhase, runner: true, ...c };
  return g;
}

// 毎フレームのキャラの動き（足・腕・鼻水など）。足が地面についた瞬間に true を返す
export function animateRacer(u, speed, t, dt, state) {
  let stepped = false;
  if (u.runner) {
    const prev = state.phase || 0;
    state.phase = prev + Math.abs(speed) * dt * 0.55;
    const amp = Math.min(1, Math.abs(speed) / 12) * 0.9;
    u.legs.forEach((l, i) => {
      const ph = state.phase + (u.legPhase ? u.legPhase[i] : i * Math.PI);
      l.rotation.x = Math.sin(ph) * amp;
      if (l.userData.knee) l.userData.knee.rotation.x = Math.max(0, Math.sin(ph + Math.PI / 2)) * amp * 1.3;
    });
    u.arms.forEach((a, i) => { a.rotation.x = -Math.sin(state.phase + i * Math.PI) * amp * 0.9; });
    u.body.position.y = Math.abs(Math.sin(state.phase)) * 0.12 * (amp > 0.1 ? 1 : 0);
    stepped = amp > 0.1 && Math.floor(state.phase / Math.PI) !== Math.floor(prev / Math.PI);
  }
  for (const a of u.anims) {
    if (a.type === 'drip') a.obj.scale.y = 0.25 + 0.2 * (Math.sin(t * 2.2) + 1);
    else if (a.type === 'bubble') a.obj.scale.setScalar(0.6 + 0.6 * (Math.sin(t * 1.8) + 1));
    else if (a.type === 'shine') a.obj.visible = Math.sin(t * 3) > 0.2;
    else if (a.type === 'beard') a.obj.rotation.z = Math.sin(t * 4) * 0.08;
    else if (a.type === 'sweat') a.obj.position.y = 0.2 - ((t * 0.8) % 1) * 0.5;
    else if (a.type === 'flutter') a.obj.rotation.x = Math.sin(t * 15) * 0.3;
    else if (a.type === 'tail') a.obj.rotation.y = Math.sin(t * a.speed) * a.amp;
    else if (a.type === 'ear') a.obj.rotation.x = Math.sin(t * 9) * 0.4;
    else if (a.type === 'tongue') a.obj.rotation.x = 0.7 + Math.sin(t * 12) * 0.15;
    else if (a.type === 'jaw') a.obj.rotation.x = 0.15 + Math.sin(t * 3) * 0.15;
  }
  return stepped;
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
