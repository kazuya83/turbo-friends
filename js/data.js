// ゲームデータ（キャラ・コース・アイテム）。すべてオリジナル。

export const LAPS = 3;
export const MAX_PLAYERS = 4;

export const CHARS = [
  { id: 'hanatare', name: 'ハナタレ', type: 'カート・スピード型', desc: '鼻水がとまらない少年。でも最高速はピカイチ。',
    color: 0x3d8bff, skin: 0xffd9b8, hair: 0x3a2a1a, quirk: 'snot', speed: 5, accel: 2, handling: 3, weight: 3 },
  { id: 'tsurupika', name: 'ツルピカ部長', type: 'カート・重量型', desc: '頭がまぶしい部長。重くて押し負けない。',
    color: 0x7a5cff, skin: 0xf0c49a, hair: 0x333333, quirk: 'bald', speed: 5, accel: 3, handling: 1, weight: 5 },
  { id: 'nebosuke', name: 'ねぼすけ', type: 'カート・加速型', desc: 'いつも半分寝ている。鼻ちょうちんでダッシュ。',
    color: 0xffb02e, skin: 0xffe0cc, hair: 0x8a5a2b, quirk: 'sleepy', speed: 2, accel: 5, handling: 4, weight: 2 },
  { id: 'afro', name: 'アフロ番長', type: 'カート・ロケット型', desc: '巨大アフロのツッパリ。速いがすべりやすい。',
    color: 0xff4d3d, skin: 0xd9a37a, hair: 0x1b1b1b, quirk: 'afro', speed: 4, accel: 4, handling: 2, weight: 3 },
  { id: 'gonzou', name: 'ゴンゾウじい', type: 'カート・曲がり型', desc: '白ひげのおじいちゃん。ハンドルさばきは名人級。',
    color: 0x2ecc9a, skin: 0xf3c99a, hair: 0xf2f2f2, quirk: 'oldman', speed: 3, accel: 3, handling: 5, weight: 2 },
  { id: 'deppa', name: 'デッパくん', type: 'カート・バランス型', desc: '出っ歯とおかっぱ頭。クセがなく扱いやすい。',
    color: 0xff5fa2, skin: 0xffe6d0, hair: 0x222222, quirk: 'buckteeth', speed: 4, accel: 3, handling: 3, weight: 3 },
  { id: 'kinta', name: 'ムキムキ金太', type: '自分で走る・重量型', desc: 'カートより自分の足が速いと信じている筋肉男。',
    color: 0xffd84a, skin: 0xe0a070, hair: 0x222222, pants: 0x2d3a8c, shoe: 0xff4d3d, quirk: 'muscle', runner: true,
    speed: 4, accel: 2, handling: 2, weight: 5 },
  { id: 'garigari', name: 'ガリガリ走太', type: '自分で走る・加速型', desc: 'ハチマキの細身ランナー。出だしが速い。',
    color: 0xf4f4f4, skin: 0xffd9b8, hair: 0x222222, pants: 0x2b6cff, shoe: 0x2ecc71, quirk: 'skinny', runner: true,
    speed: 3, accel: 5, handling: 4, weight: 1 },
  { id: 'obachan', name: 'ダッシュおばちゃん', type: '自分で走る・曲がり型', desc: '特売に向かうおばちゃん。小回りが最強。',
    color: 0xb36bff, skin: 0xf3c99a, hair: 0x6a3a8a, pants: 0x5a3a2a, shoe: 0xffffff, quirk: 'auntie', runner: true,
    speed: 3, accel: 3, handling: 5, weight: 3 },
  { id: 'pochi', name: 'ポチ丸', type: '犬・加速型', desc: 'ベロを出してしっぽフリフリ。出だしが速い。',
    color: 0xc98b4f, sub: 0xf5e1c0, animal: 'dog', runner: true, step: 'paw',
    speed: 2, accel: 5, handling: 4, weight: 2 },
  { id: 'futeneko', name: 'ふてねこ', type: '猫・曲がり型', desc: 'いつも不機嫌なぽっちゃり猫。カーブはおまかせ。',
    color: 0xff9f43, sub: 0xffe3c2, stripe: 0xd9702a, animal: 'cat', runner: true, step: 'paw',
    speed: 3, accel: 3, handling: 5, weight: 3 },
  { id: 'tyranno', name: 'ティラノ太', type: '恐竜・重量型', desc: '短い手がチャームポイント。重くて速い。',
    color: 0x4caf50, sub: 0xc5e86c, animal: 'dino', runner: true, step: 'heavy',
    speed: 5, accel: 2, handling: 1, weight: 5 },
];

export function statsOf(c) {
  return {
    max: 30 + c.speed * 1.7,
    accel: 8 + c.accel * 2.8,
    turn: 1.45 + c.handling * 0.2,
    weight: c.weight,
  };
}

export const ITEMS = {
  turbo:  { name: 'ターボ缶', icon: '⚡' },
  turbo3: { name: 'トリプルターボ', icon: '⚡' },
  slime:  { name: 'ねばねばスライム', icon: '🟢' },
  bomb:   { name: 'ボンバーボール', icon: '💣' },
  seeker: { name: 'ホーミングスター', icon: '⭐' },
  shield: { name: 'バリア', icon: '🛡️' },
};

// 順位（0=1位 … 3=4位）ごとの出やすさ
export const ITEM_TABLE = [
  { slime: 40, bomb: 30, shield: 20, turbo: 10 },
  { slime: 25, bomb: 30, turbo: 25, shield: 10, seeker: 10 },
  { turbo: 30, bomb: 25, seeker: 20, turbo3: 15, slime: 10 },
  { turbo3: 35, seeker: 30, turbo: 25, bomb: 10 },
];

export const TRACKS = [
  {
    id: 'meadow', name: 'そよかぜ草原', width: 20,
    theme: { sky: 0x8fd3ff, fog: 0xbfe6ff, fogNear: 180, fogFar: 700, ground: 0x5fbf4a,
      wall: 0xf2e6c9, hemi: [0xffffff, 0x557744, 1.0], sun: 1.6, night: false },
    points: [[0, 150], [90, 140], [160, 90], [175, 0], [140, -70], [70, -85], [30, -140],
      [-50, -170], [-130, -130], [-160, -50], [-115, 15], [-140, 95], [-80, 150]],
    boxes: [0.12, 0.45, 0.76],
    pads: [[0.3, 0], [0.62, -5], [0.9, 5]],
    deco: 'meadow',
  },
  {
    id: 'desert', name: 'サンサン砂漠', width: 20,
    theme: { sky: 0xffd9a0, fog: 0xffe2b8, fogNear: 160, fogFar: 650, ground: 0xe8c27a,
      wall: 0xc98b4f, hemi: [0xfff3dd, 0xa0703a, 1.0], sun: 1.8, night: false },
    points: [[0, 190], [110, 180], [185, 120], [170, 45], [95, 30], [75, -35], [150, -85],
      [140, -170], [40, -195], [-30, -130], [-110, -175], [-190, -110], [-175, -5],
      [-115, 15], [-105, 50], [-160, 115], [-85, 185]],
    boxes: [0.1, 0.4, 0.7],
    pads: [[0.22, 0], [0.55, 4], [0.85, -4]],
    deco: 'desert',
  },
  {
    id: 'city', name: 'ネオン夜の街', width: 20,
    theme: { sky: 0x0b1030, fog: 0x141a40, fogNear: 120, fogFar: 520, ground: 0x23263a,
      wall: 0x3a3f66, hemi: [0x8090ff, 0x202030, 0.55], sun: 0.35, night: true },
    points: [[-160, 160], [0, 170], [160, 160], [180, 65], [125, 40], [125, 0], [170, -40], [170, -160],
      [65, -180], [20, -120], [-20, -120], [-65, -180], [-170, -160], [-180, -45], [-125, -20], [-125, 20], [-180, 65]],
    boxes: [0.08, 0.38, 0.68],
    pads: [[0.18, 0], [0.5, 0], [0.82, 0]],
    deco: 'city',
  },
  {
    id: 'snow', name: 'ゆきやまスノー', width: 20,
    theme: { sky: 0xcfe3f5, fog: 0xe6f0fa, fogNear: 150, fogFar: 600, ground: 0xf4f8fc,
      wall: 0x9fb6c9, hemi: [0xffffff, 0xa8c0d8, 1.0], sun: 1.5, night: false },
    points: [[0, 200], [120, 190], [200, 130], [210, 40], [150, 20], [150, -25], [190, -70],
      [160, -160], [70, -200], [10, -150], [-40, -80], [-110, -110], [-190, -80], [-200, 20],
      [-140, 70], [-180, 140], [-110, 200]],
    boxes: [0.1, 0.42, 0.72],
    pads: [[0.25, 0], [0.58, 4], [0.88, -4]],
    deco: 'snow',
  },
  {
    id: 'beach', name: 'トロピカル海岸', width: 20,
    theme: { sky: 0x7fd4ff, fog: 0xbfeaff, fogNear: 180, fogFar: 700, ground: 0xf2dca0,
      wall: 0xffffff, hemi: [0xffffff, 0x8fb0c0, 1.0], sun: 1.6, night: false },
    points: [[0, 150], [100, 160], [180, 110], [200, 20], [150, -40], [90, -20], [40, -70],
      [80, -140], [0, -190], [-100, -170], [-170, -100], [-150, -20], [-190, 60], [-130, 130]],
    boxes: [0.12, 0.44, 0.74],
    pads: [[0.28, 0], [0.6, -4], [0.9, 4]],
    deco: 'beach',
  },
];
