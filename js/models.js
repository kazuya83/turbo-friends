// カート・キャラ・アイテムの3Dモデル（すべて図形の組み合わせで作るオリジナル）
import * as THREE from 'three';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function lighten(hex, k) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), k);
  return c;
}

// キャラの見た目。カートに乗るキャラと、自分の足で走るキャラがいる
export function buildKartMesh(ch) {
  if (ch.animal) return buildAnimal(ch);
  return ch.runner ? buildRunner(ch) : buildKart(ch);
}

function commonParts(g, body, ch, opts) {
  // 影
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.9, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.06; shadow.scale.set(opts.shadowX, 1.15, 1);
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

function buildKart(ch) {
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
  add(new THREE.BoxGeometry(0.9, 0.12, 0.9), lambert(0xdddddd), 0, 0.85, 0.85);
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
    w.add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.3), hub));
    body.add(w); wheels.push(w);
  }

  // ドライバー
  add(new THREE.CylinderGeometry(0.36, 0.42, 0.75, 10), lambert(lighten(ch.color, 0.25)), 0, 1.3, -0.25);
  const anims = [];
  const head = buildHead(ch, anims);
  head.position.set(0, 2.08, -0.2); head.scale.setScalar(1.3);
  body.add(head);
  for (const s of [-1, 1]) {
    const arm = add(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 6), lambert(lighten(ch.color, 0.25)), s * 0.38, 1.35, 0.15);
    arm.rotation.x = 1.1; arm.rotation.z = s * 0.25;
  }

  const c = commonParts(g, body, ch, { shadowX: 0.8, flameY: 0.6, flameZ: -2.3, sparkX: [1.15, -1.15], sparkZ: -1.5 });
  g.userData = { body, wheels, legs: [], arms: [], anims, ...c };
  return g;
}

function buildRunner(ch) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shirt = lambert(ch.color);
  const skin = lambert(ch.skin);
  const pants = lambert(ch.pants || 0x2d3a8c);
  const shoe = lambert(ch.shoe || 0xff4d3d);
  const muscle = ch.quirk === 'muscle', skinny = ch.quirk === 'skinny';
  const bw = muscle ? 1.25 : skinny ? 0.7 : 0.95;

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * bw, 0.36 * bw, 1.0, 12), shirt);
  torso.position.y = 1.75; body.add(torso);
  if (ch.quirk === 'auntie') { // エプロン
    const ap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.06), lambert(0xffffff));
    ap.position.set(0, 1.55, 0.36); body.add(ap);
  }
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.37 * bw, 0.4 * bw, 0.35, 12), pants);
  hips.position.y = 1.15; body.add(hips);

  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * 0.2 * bw, 1.1, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * bw, 0.11 * bw, 0.95, 8), skinny ? skin : pants);
    thigh.position.y = -0.47; leg.add(thigh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.48), shoe);
    foot.position.set(0, -0.98, 0.1); leg.add(foot);
    body.add(leg); legs.push(leg);

    const arm = new THREE.Group(); arm.position.set(s * (0.48 * bw + 0.08), 2.15, 0);
    const up = new THREE.Mesh(new THREE.CylinderGeometry((muscle ? 0.2 : 0.09), (muscle ? 0.16 : 0.08), 0.85, 8), skin);
    up.position.y = -0.4; arm.add(up);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(muscle ? 0.18 : 0.11, 8, 6), skin);
    hand.position.y = -0.85; arm.add(hand);
    if (ch.quirk === 'auntie' && s === 1) { // 買い物ぶくろ
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.25), lambert(0xffd84a));
      bag.position.y = -1.1; arm.add(bag);
      const leek = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), lambert(0x6fdc4a));
      leek.position.set(0.08, -0.75, 0); arm.add(leek);
    }
    body.add(arm); arms.push(arm);
  }

  const anims = [];
  const head = buildHead(ch, anims);
  head.position.set(0, 2.72, 0.02); head.scale.setScalar(1.3);
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
    ? new THREE.MeshStandardMaterial({ color: ch.skin, roughness: 0.12, metalness: 0.05 })
    : lambert(ch.skin);
  m(new THREE.SphereGeometry(0.46, 18, 14), skinMat, 0, 0, 0);
  const hair = lambert(ch.hair);
  const black = lambert(0x1b1b1b), white = lambert(0xffffff);
  const eyes = () => { for (const s of [-1, 1]) m(new THREE.SphereGeometry(0.07, 8, 6), black, s * 0.16, 0.04, 0.42); };
  const nose = () => m(new THREE.SphereGeometry(0.08, 8, 6), lambert(new THREE.Color(ch.skin).multiplyScalar(0.92)), 0, -0.06, 0.46);

  switch (ch.quirk) {
    case 'snot': { // ボサボサ頭と、たれる鼻水
      eyes(); nose();
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        const sp = m(new THREE.ConeGeometry(0.12, 0.4, 6), hair, Math.cos(a) * 0.25, 0.42, Math.sin(a) * 0.25 - 0.05);
        sp.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      }
      const snotMat = new THREE.MeshStandardMaterial({ color: 0x9be86a, roughness: 0.1, transparent: true, opacity: 0.9 });
      const drip = new THREE.Group(); drip.position.set(0.05, -0.12, 0.5); head.add(drip);
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1, 6), snotMat);
      line.position.y = -0.5; drip.add(line);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), snotMat);
      ball.position.y = -1; drip.add(ball);
      anims.push({ type: 'drip', obj: drip });
      break;
    }
    case 'bald': { // ツルツル頭、横だけ髪、メガネ、ヒゲ
      for (const s of [-1, 1]) {
        const h = m(new THREE.SphereGeometry(0.16, 8, 6), hair, s * 0.42, 0.02, -0.08); h.scale.set(0.6, 1, 1.4);
        const lens = m(new THREE.TorusGeometry(0.11, 0.025, 6, 14), black, s * 0.16, 0.05, 0.43);
        lens.rotation.y = s * 0.1;
      }
      eyes(); nose();
      const stache = m(new THREE.BoxGeometry(0.34, 0.07, 0.08), hair, 0, -0.16, 0.42);
      stache.rotation.z = 0.05;
      const shine = m(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.12, 0.38, 0.18);
      anims.push({ type: 'shine', obj: shine });
      break;
    }
    case 'sleepy': { // 閉じた目、ナイトキャップ、鼻ちょうちん
      for (const s of [-1, 1]) m(new THREE.BoxGeometry(0.14, 0.025, 0.03), black, s * 0.16, 0.04, 0.44);
      nose();
      const cap = m(new THREE.ConeGeometry(0.42, 0.9, 14), lambert(0x6f9cff), -0.05, 0.5, -0.05);
      cap.rotation.z = 0.55;
      m(new THREE.SphereGeometry(0.11, 8, 6), white, -0.42, 0.78, -0.05);
      const bub = m(new THREE.SphereGeometry(0.12, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.55, roughness: 0.05 }), 0.12, -0.08, 0.55);
      anims.push({ type: 'bubble', obj: bub });
      break;
    }
    case 'afro': { // 巨大アフロとサングラス
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI * 2, y = 0.3 + (i % 2) * 0.2;
        m(new THREE.SphereGeometry(0.32, 8, 6), hair, Math.cos(a) * 0.45, y, Math.sin(a) * 0.4 - 0.1);
      }
      m(new THREE.SphereGeometry(0.5, 10, 8), hair, 0, 0.6, -0.1);
      m(new THREE.BoxGeometry(0.5, 0.12, 0.06), black, 0, 0.05, 0.44);
      nose();
      m(new THREE.BoxGeometry(0.18, 0.05, 0.05), lambert(0xffffff), 0, -0.2, 0.42);
      break;
    }
    case 'oldman': { // 白いヒゲ、太いまゆ毛、てっぺんハゲ
      eyes(); nose();
      for (const s of [-1, 1]) {
        const brow = m(new THREE.BoxGeometry(0.2, 0.07, 0.07), hair, s * 0.17, 0.17, 0.42);
        brow.rotation.z = -s * 0.25;
        const side = m(new THREE.SphereGeometry(0.17, 8, 6), hair, s * 0.4, 0.05, -0.12); side.scale.set(0.6, 1, 1.3);
      }
      const beard = m(new THREE.SphereGeometry(0.3, 10, 8), hair, 0, -0.32, 0.25);
      beard.scale.set(1.05, 1.3, 0.7);
      anims.push({ type: 'beard', obj: beard });
      break;
    }
    case 'buckteeth': { // おかっぱ頭と出っ歯
      const bowl = m(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 1.9), hair, 0, 0.04, -0.02);
      bowl.rotation.x = -0.12;
      eyes(); nose();
      for (const s of [-1, 1]) m(new THREE.BoxGeometry(0.09, 0.14, 0.05), white, s * 0.05, -0.2, 0.45);
      break;
    }
    case 'muscle': { // 角刈り・汗
      m(new THREE.BoxGeometry(0.72, 0.18, 0.72), hair, 0, 0.36, -0.03);
      for (const s of [-1, 1]) { const brow = m(new THREE.BoxGeometry(0.18, 0.07, 0.06), black, s * 0.16, 0.16, 0.42); brow.rotation.z = s * 0.3; }
      eyes(); nose();
      m(new THREE.BoxGeometry(0.22, 0.05, 0.05), lambert(0xffffff), 0, -0.2, 0.42);
      const sweat = m(new THREE.SphereGeometry(0.07, 8, 6), lambert(0x8fd8ff), 0.42, 0.2, 0.2);
      anims.push({ type: 'sweat', obj: sweat });
      break;
    }
    case 'skinny': { // ハチマキと出っぱった頬骨
      m(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 16), lambert(0xffffff), 0, 0.2, 0);
      m(new THREE.SphereGeometry(0.08, 8, 6), lambert(0xff3b3b), 0, 0.2, 0.47);
      const tail = m(new THREE.BoxGeometry(0.06, 0.08, 0.5), lambert(0xffffff), 0.1, 0.18, -0.65);
      anims.push({ type: 'flutter', obj: tail });
      m(new THREE.SphereGeometry(0.36, 10, 6, 0, Math.PI * 2, 0, Math.PI / 3), hair, 0, 0.18, -0.08);
      eyes(); nose();
      break;
    }
    case 'auntie': { // パーマとカーラー、赤い口紅
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2;
        m(new THREE.SphereGeometry(0.2, 8, 6), hair, Math.cos(a) * 0.35, 0.3 + Math.sin(i) * 0.05, Math.sin(a) * 0.32 - 0.1);
      }
      for (const [x, z] of [[-0.2, 0.1], [0.2, 0.05], [0, -0.25]]) {
        const cu = m(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8), lambert(0xff8fab), x, 0.55, z);
        cu.rotation.z = Math.PI / 2;
      }
      eyes(); nose();
      m(new THREE.BoxGeometry(0.16, 0.06, 0.05), lambert(0xe0203a), 0, -0.2, 0.42);
      break;
    }
    default: eyes(); nose();
  }
  // ほっぺ
  for (const s of [-1, 1]) m(new THREE.SphereGeometry(0.06, 8, 6), lambert(0xff9a9a), s * 0.28, -0.12, 0.36);
  return head;
}

// 犬・猫・恐竜（4本足または2本足で走る）
function buildAnimal(ch) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const fur = lambert(ch.color), sub = lambert(ch.sub), black = lambert(0x1b1b1b), white = lambert(0xffffff);
  const add = (geo, mat, x, y, z, parent = body) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); parent.add(o); return o; };
  const legs = [], arms = [], anims = [];
  const legPhase = [];
  const kind = ch.animal;

  if (kind === 'dino') {
    const torso = add(new THREE.SphereGeometry(0.9, 16, 12), fur, 0, 1.9, -0.1);
    torso.scale.set(0.9, 1.0, 1.3); torso.rotation.x = -0.35;
    add(new THREE.SphereGeometry(0.62, 14, 10), sub, 0, 1.75, 0.45).scale.set(0.9, 1.1, 0.6);
    const head = new THREE.Group(); head.position.set(0, 3.0, 0.75); body.add(head);
    add(new THREE.BoxGeometry(0.85, 0.7, 1.2), fur, 0, 0, 0.15, head);
    const jaw = add(new THREE.BoxGeometry(0.8, 0.22, 1.05), fur, 0, -0.42, 0.18, head);
    for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.06, 0.16, 4), white, -0.3 + i * 0.2, -0.27, 0.68, head).rotation.x = Math.PI;
    for (const s of [-1, 1]) {
      add(new THREE.SphereGeometry(0.15, 10, 8), white, s * 0.3, 0.22, 0.35, head);
      add(new THREE.SphereGeometry(0.08, 8, 6), black, s * 0.33, 0.24, 0.47, head);
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
    const torso = add(new THREE.SphereGeometry(0.7, 16, 12), fur, 0, 1.25, -0.1);
    torso.scale.set(cat ? 1.15 : 0.85, cat ? 0.95 : 0.8, 1.55);
    const belly = add(new THREE.SphereGeometry(0.5, 12, 10), sub, 0, 1.0, 0.0);
    belly.scale.set(cat ? 1.2 : 0.9, 0.6, 1.5);
    const head = new THREE.Group(); head.position.set(0, 2.0, 1.05); body.add(head);
    add(new THREE.SphereGeometry(0.55, 16, 12), fur, 0, 0, 0, head).scale.set(cat ? 1.1 : 1, 0.95, 1);
    add(new THREE.SphereGeometry(0.3, 12, 10), sub, 0, -0.15, 0.4, head).scale.set(1.1, 0.75, 0.9);
    add(new THREE.SphereGeometry(0.1, 8, 6), cat ? lambert(0xff8fab) : black, 0, -0.02, 0.66, head);
    for (const s of [-1, 1]) {
      if (cat) { // ふてくされた半目
        add(new THREE.SphereGeometry(0.12, 10, 8), lambert(0xd8f27a), s * 0.22, 0.12, 0.45, head);
        const lid = add(new THREE.SphereGeometry(0.13, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), fur, s * 0.22, 0.13, 0.46, head);
        lid.rotation.x = -0.2;
        add(new THREE.BoxGeometry(0.1, 0.05, 0.05), black, s * 0.22, 0.1, 0.56, head);
        const ear = add(new THREE.ConeGeometry(0.2, 0.4, 4), fur, s * 0.32, 0.55, -0.05, head);
        ear.rotation.z = -s * 0.25;
        for (const k of [-1, 1]) {
          const wh = add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), white, s * 0.38, -0.12 + k * 0.05, 0.45, head);
          wh.rotation.z = Math.PI / 2 + k * 0.15;
        }
      } else {
        add(new THREE.SphereGeometry(0.09, 8, 6), black, s * 0.2, 0.15, 0.48, head);
        const ear = add(new THREE.SphereGeometry(0.22, 10, 8), sub, s * 0.5, 0.05, -0.05, head);
        ear.scale.set(0.45, 1.3, 0.8);
        anims.push({ type: 'ear', obj: ear, side: s });
      }
    }
    if (!cat) { // ベロを出している
      const tongue = add(new THREE.BoxGeometry(0.16, 0.04, 0.3), lambert(0xff6b8a), 0.05, -0.33, 0.6, head);
      tongue.rotation.x = 0.7;
      anims.push({ type: 'tongue', obj: tongue });
    } else {
      // 太ったお腹のしま
      for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.72, 0.05, 4, 20, Math.PI), lambert(ch.stripe), 0, 1.3, -0.5 + i * 0.35).rotation.y = Math.PI / 2;
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
    u.legs.forEach((l, i) => { l.rotation.x = Math.sin(state.phase + (u.legPhase ? u.legPhase[i] : i * Math.PI)) * amp; });
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
