// ゲームデータ（キャラ・コース・アイテム）。すべてオリジナル。

export const LAPS = 3;
export const MAX_PLAYERS = 4;

export const CHARS = [
  { id: 'biritto', name: 'ビリット', type: 'でんき・スピード型', desc: 'ビリビリ角のでんきモンスター。最高速がとにかく速い。',
    color: 0x2b6cff, body: 0x6fe3ff, acc: 'bolt', speed: 5, accel: 2, handling: 3, weight: 3 },
  { id: 'fuwari', name: 'フワリ', type: 'かぜ・加速型', desc: 'ふわふわ雲のモンスター。ぶつかってもすぐ立ち直る。',
    color: 0xffb02e, body: 0xf7f7ff, acc: 'wings', speed: 2, accel: 5, handling: 4, weight: 2 },
  { id: 'shizuku', name: 'シズク', type: 'みず・曲がり型', desc: 'しずく形のみずモンスター。カーブがとても得意。',
    color: 0xff5fa2, body: 0x4aa8ff, acc: 'fin', speed: 3, accel: 3, handling: 5, weight: 2 },
  { id: 'goron', name: 'ゴロン', type: 'いわ・重量型', desc: 'ゴツゴツいわモンスター。重くて押し負けない。',
    color: 0x7a5cff, body: 0x9a8f86, acc: 'rock', speed: 5, accel: 3, handling: 1, weight: 5 },
  { id: 'mokko', name: 'モッコ', type: 'くさ・バランス型', desc: '頭に芽が生えたくさモンスター。だれでも扱いやすい。',
    color: 0x2ecc9a, body: 0x8fd46a, acc: 'sprout', speed: 4, accel: 3, handling: 3, weight: 3 },
  { id: 'homura', name: 'ホムラ', type: 'ほのお・ロケット型', desc: '頭がメラメラ燃えるほのおモンスター。速いがすべりやすい。',
    color: 0xff4d3d, body: 0xff8a3d, acc: 'flame', speed: 4, accel: 4, handling: 2, weight: 3 },
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
];
