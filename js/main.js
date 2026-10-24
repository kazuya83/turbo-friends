// ターボフレンズ 本体：画面遷移・ロビー・レース進行
import * as THREE from 'three';
import { CHARS, TRACKS, ITEMS, ITEM_TABLE, LAPS, MAX_PLAYERS } from './data.js';
import { Track } from './track.js';
import { buildKartMesh, animateRacer, makeNameTag, buildCrystal, buildEntityMesh, buildPad, buildBurst } from './models.js';
import { Kart, aiInput, wrapAngle, HOP_TIME } from './kart.js';
import { Net, makeCode } from './net.js';
import * as A from './audio.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても続行 */ } },
};
const TEST = { auto: false };
const SPARK = [0, 0x4fc3ff, 0xff9a2e, 0xc77dff];
const ITEM_DESC = {
  turbo: '一瞬だけ大加速', turbo3: 'ターボが3回使える', slime: '後ろに置くワナ。ふむとスピン',
  bomb: '前に転がる爆弾。壁で跳ね返る', seeker: '前の相手を追いかける星', shield: '6秒間こうげきを1回ふせぐ',
};

// ---------- 描画の準備 ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.5, 2500);

const menu = (() => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x16205a);
  scene.fog = new THREE.Fog(0x16205a, 30, 90);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.1));
  const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(5, 10, 7); scene.add(d);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 0.4, 48), new THREE.MeshLambertMaterial({ color: 0x2a3a8a }));
  floor.position.y = -0.2; scene.add(floor);
  const neon = new THREE.Mesh(new THREE.TorusGeometry(14, 0.15, 6, 64), new THREE.MeshBasicMaterial({ color: 0x6fe3ff }));
  neon.rotation.x = Math.PI / 2; scene.add(neon);
  const ring = new THREE.Group();
  CHARS.forEach((c, i) => {
    const m = buildKartMesh(c);
    const a = i / CHARS.length * Math.PI * 2;
    m.position.set(Math.cos(a) * 10, 0, Math.sin(a) * 10);
    m.rotation.y = Math.PI - a;
    ring.add(m);
  });
  scene.add(ring);
  const solo = new THREE.Group(); scene.add(solo);
  const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 300);
  return { scene, ring, solo, cam, charIdx: -1 };
})();

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  for (const c of [camera, menu.cam]) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); }
});

function setShowroomChar(i) {
  if (menu.charIdx === i) return;
  menu.charIdx = i;
  menu.solo.clear();
  menu.solo.add(buildKartMesh(CHARS[i]));
}

function updateMenuScene(dt) {
  const lobby = UI.screen === 'lobby';
  menu.ring.visible = !lobby; menu.solo.visible = lobby;
  menu.t = (menu.t || 0) + dt;
  for (const grp of [menu.ring, menu.solo]) for (const c of grp.children) animateRacer(c.userData, 14, menu.t, dt, c.userData);
  if (lobby) {
    if (!TEST.freeze) menu.solo.rotation.y += dt * 0.7;
    menu.cam.position.set(0, 3.2, 10.5);
    menu.cam.lookAt(innerWidth > 1000 ? 4.2 : 0, 1.5, 0);
  } else {
    menu.ring.rotation.y += dt * 0.25;
    menu.cam.position.set(0, 7, 23);
    menu.cam.lookAt(0, 1, 0);
  }
}

// ---------- キー入力 ----------
const keys = new Set();
const pressed = new Set();
const isDown = (...c) => c.some((k) => keys.has(k));
const wasPressed = (...c) => c.some((k) => pressed.has(k));
const typing = () => document.activeElement && document.activeElement.tagName === 'INPUT';

addEventListener('keydown', (e) => {
  A.initAudio();
  if (!e.repeat) pressed.add(e.code);
  keys.add(e.code);
  if (e.code === 'Tab') e.preventDefault();
  if (G.race && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space' && !typing()) e.preventDefault();
  onKey(e);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('pointerdown', () => A.initAudio());

// ---------- ゲームコントローラー ----------
// レース中の操作はPad*という仮想キーで持ち、メニューでは矢印・Enter・Escのキー入力として送る
const pad = { held: new Set(), steer: 0, repeatT: 0, known: false };
const fakeKey = (code) => onKey({ code, repeat: false, shiftKey: false, preventDefault() {} });
addEventListener('gamepadconnected', () => { if (!pad.known) { pad.known = true; toast('コントローラーをつなぎました'); } });

function pollGamepad(dt) {
  const gps = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gp = gps[0];
  const now = new Set();
  pad.steer = 0;
  if (gp) {
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4));
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (b(12) || ay < -0.5) now.add('NavUp');
    if (b(13) || ay > 0.5) now.add('NavDown');
    if (b(14) || ax < -0.5) now.add('NavLeft');
    if (b(15) || ax > 0.5) now.add('NavRight');
    if (b(0)) now.add('NavOk');
    if (b(1)) now.add('NavBack');
    if (b(9)) now.add('NavStart');
    if (b(0) || b(7)) now.add('PadGas');
    if (b(1) || b(6)) now.add('PadBrake');
    if (b(4) || b(5)) now.add('PadDrift');
    if (b(2) || b(3)) now.add('PadItem');
    if (b(14)) now.add('PadLeft');
    if (b(15)) now.add('PadRight');
    if (b(13) || ay > 0.6) now.add('PadBack');
    if (Math.abs(ax) > 0.18) pad.steer = -Math.sign(ax) * Math.min(1, (Math.abs(ax) - 0.18) / 0.6);
  }
  const menuMode = !!UI.screen || !$('overlay-msg').classList.contains('hidden') || (G.race && G.race.paused);
  const navMap = { NavUp: 'ArrowUp', NavDown: 'ArrowDown', NavLeft: 'ArrowLeft', NavRight: 'ArrowRight', NavOk: 'Enter', NavBack: 'Escape' };
  for (const c of now) {
    if (!pad.held.has(c)) {
      if (c.startsWith('Pad')) { keys.add(c); pressed.add(c); }
      if (c === 'NavStart') { A.initAudio(); fakeKey('Escape'); }
      else if (menuMode && navMap[c]) { A.initAudio(); fakeKey(navMap[c]); pad.repeatT = 0.4; }
    }
  }
  for (const c of pad.held) if (!now.has(c) && c.startsWith('Pad')) keys.delete(c);
  // メニューで上下左右を押しっぱなしにしたときのくり返し
  const dir = ['NavUp', 'NavDown', 'NavLeft', 'NavRight'].find((c) => now.has(c) && pad.held.has(c));
  if (menuMode && dir) {
    pad.repeatT -= dt;
    if (pad.repeatT <= 0) { fakeKey(navMap[dir]); pad.repeatT = 0.15; }
  }
  pad.held = now;
}

function onKey(e) {
  if (!$('overlay-msg').classList.contains('hidden')) {
    if (e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); $('overlay-msg').classList.add('hidden'); refreshRows(); }
    return;
  }
  if (e.code === 'KeyM' && !typing()) { const m = A.toggleMute(); toast(m ? '音オフ' : '音オン'); }
  if (UI.screen) menuKey(e);
  else if (G.race) raceKey(e);
}

// ---------- メニュー画面 ----------
const UI = { screen: null, focus: 0, rows: [] };

function show(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  UI.screen = name; UI.focus = 0;
  refreshRows();
}
function hideScreens() {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  UI.screen = null;
  if (typing()) document.activeElement.blur();
}
function refreshRows() {
  if (!UI.screen) return;
  UI.rows = [...$('screen-' + UI.screen).querySelectorAll('.row')].filter((r) => !r.classList.contains('hidden'));
  UI.focus = Math.max(0, Math.min(UI.focus, UI.rows.length - 1));
  UI.rows.forEach((r, i) => r.classList.toggle('focused', i === UI.focus));
  const inp = UI.rows[UI.focus]?.querySelector('input');
  if (inp) { if (document.activeElement !== inp) inp.focus(); } else if (typing()) document.activeElement.blur();
}
function focusAct(act) {
  const i = UI.rows.findIndex((r) => r.dataset.act === act);
  if (i >= 0) { UI.focus = i; refreshRows(); }
}

function menuKey(e) {
  const n = UI.rows.length;
  const row = UI.rows[UI.focus];
  const act = row?.dataset.act;
  switch (e.code) {
    case 'ArrowUp': case 'ArrowDown': case 'Tab':
      e.preventDefault();
      if (!n) break;
      UI.focus = (UI.focus + (e.code === 'ArrowUp' || (e.code === 'Tab' && e.shiftKey) ? -1 : 1) + n) % n;
      refreshRows(); A.sfx.menu();
      break;
    case 'ArrowLeft': case 'ArrowRight':
      if (row && !row.querySelector('input')) { e.preventDefault(); actions[act]?.({ dir: e.code === 'ArrowLeft' ? -1 : 1 }); }
      break;
    case 'Enter': case 'NumpadEnter':
      e.preventDefault();
      if (UI.screen === 'results') { resultsEnter(); break; }
      if (act) { A.sfx.select(); actions[act]?.({ enter: true }); }
      break;
    case 'Escape':
      e.preventDefault();
      backActions[UI.screen]?.();
      break;
    case 'KeyC':
      if (UI.screen === 'lobby' && !G.solo && !typing()) copyInvite();
      break;
  }
}

const actions = {
  name: () => { UI.focus++; refreshRows(); },
  create: () => hostCreate(),
  gojoin: () => {
    if (!checkName()) return;
    show('join');
    if ($('in-code').value.trim().length === 4) focusAct('dojoin');
  },
  solo: () => startSolo(),
  howto: () => show('howto'),
  code: () => doJoin(),
  dojoin: () => doJoin(),
  back: () => show('title'),
  char: (o) => {
    if (!o.dir) return;
    G.myChar = (G.myChar + o.dir + CHARS.length) % CHARS.length;
    store.set('tf-char', G.myChar);
    A.sfx.menu(); sendPick(); renderLobby();
  },
  course: (o) => {
    if (!G.isHost || !o.dir) return;
    G.lobby.course = (G.lobby.course + o.dir + TRACKS.length) % TRACKS.length;
    A.sfx.menu(); broadcastLobby();
  },
  ready: (o) => {
    if (!o.enter && !o.dir) return;
    G.myReady = !G.myReady; sendPick(); renderLobby();
  },
  start: (o) => { if (o.enter) tryStart(); },
  leave: (o) => { if (o.enter) leaveRoom(); },
};
const backActions = {
  join: () => show('title'),
  howto: () => show('title'),
  lobby: () => focusAct('leave'),
};

function showOverlay(text) {
  $('overlay-text').textContent = text;
  $('overlay-msg').classList.remove('hidden');
  if (typing()) document.activeElement.blur();
}

// ---------- ゲームの状態 ----------
const G = {
  name: '', net: null, isHost: false, solo: false, myId: 'me', code: '',
  myChar: Math.min(CHARS.length - 1, Math.max(0, parseInt(store.get('tf-char', '0'), 10) || 0)),
  myReady: false,
  lobby: { course: 0, players: [], inRace: false },
  race: null,
};

function checkName() {
  const v = $('in-name').value.trim().slice(0, 8);
  if (!v) {
    if (UI.screen === 'title') { $('title-err').textContent = 'なまえを入れてね'; UI.focus = 0; refreshRows(); }
    return false;
  }
  G.name = v; store.set('tf-name', v);
  $('title-err').textContent = '';
  return true;
}

function inviteUrl() {
  return `${location.origin}${location.pathname}?room=${G.code}`;
}
function copyInvite() {
  const url = inviteUrl();
  const ok = () => { $('lobby-err').textContent = '招待URLをコピーしました！ともだちに送ってね'; };
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, () => { $('lobby-err').textContent = url; });
  else $('lobby-err').textContent = url;
}

// ---------- ロビー ----------
function renderLobby() {
  const L = G.lobby;
  const scr = $('screen-lobby');
  $('lobby-title').textContent = G.solo ? 'ひとりで練習' : 'ロビー';
  $('lobby-code-box').classList.toggle('hidden', G.solo);
  $('lobby-code').textContent = G.code;
  $('lobby-invite').textContent = G.solo ? '' : `招待URL: ${inviteUrl()}（C キーでコピー）`;
  scr.querySelectorAll('.host-only').forEach((e) => e.classList.toggle('hidden', !G.isHost));
  scr.querySelectorAll('.guest-only').forEach((e) => e.classList.toggle('hidden', G.isHost));
  const c = CHARS[G.myChar];
  $('char-name').textContent = c.name;
  $('char-type').textContent = c.type;
  $('char-desc').textContent = c.desc;
  for (const k of ['speed', 'accel', 'handling', 'weight']) $('st-' + k).style.setProperty('--v', c[k] * 20 + '%');
  $('course-name').textContent = TRACKS[L.course].name;
  $('guest-course').textContent = `コース：${TRACKS[L.course].name}（親が決めます）`;
  $('ready-state').textContent = G.myReady ? 'OK！' : 'まだ（Enterで準備OK）';
  const ul = $('player-list');
  ul.innerHTML = '';
  for (const p of L.players) {
    const li = document.createElement('li');
    const ch = CHARS[p.char] || CHARS[0];
    const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = '#' + ch.color.toString(16).padStart(6, '0');
    const nm = document.createElement('span'); nm.className = 'pn'; nm.textContent = `${p.name}（${ch.name}）${p.id === G.myId ? ' ← あなた' : ''}`;
    const tag = document.createElement('span');
    tag.className = 'tag ' + (p.host ? '' : p.ready ? 'ok' : 'wait');
    tag.textContent = p.host ? '親' : p.ready ? '準備OK' : '準備中';
    li.append(dot, nm, tag); ul.append(li);
  }
  $('pcount').textContent = `${L.players.length}/${MAX_PLAYERS}`;
  const allReady = L.players.every((p) => p.host || p.ready);
  $('start-note').textContent = allReady ? 'Enterでスタート' : '全員の準備OKを待っています';
  if (L.inRace && !G.race && !G.isHost) $('lobby-err').textContent = 'いまレース中です。次のレースから参加できます';
  else if ($('lobby-err').textContent.startsWith('いまレース中')) $('lobby-err').textContent = '';
  refreshRows();
  setShowroomChar(G.myChar);
}

function sendPick() {
  if (G.isHost) {
    const me = G.lobby.players.find((p) => p.id === G.myId);
    if (me) me.char = G.myChar;
    broadcastLobby();
  } else G.net?.toHost({ t: 'pick', char: G.myChar, ready: G.myReady });
}

function broadcastLobby() {
  G.net?.broadcast({ t: 'lobby', lobby: G.lobby });
  if (UI.screen === 'lobby') renderLobby();
}

function startSolo() {
  if (!checkName()) return;
  leaveRoom(false);
  G.solo = true; G.isHost = true; G.net = null; G.myId = 'me'; G.code = ''; G.myReady = true;
  G.lobby = { course: G.lobby.course || 0, players: [{ id: 'me', name: G.name, char: G.myChar, ready: true, host: true }], inRace: false };
  show('lobby'); renderLobby();
}

async function hostCreate() {
  if (!checkName()) return;
  leaveRoom(false);
  $('title-err').textContent = '部屋を作っています…';
  let net = null;
  for (let tries = 0; tries < 4 && !net; tries++) {
    const n = new Net();
    const code = makeCode();
    try { await n.host(code); net = n; G.code = code; } catch (e) {
      n.close();
      if (e && e.type === 'unavailable-id') continue;
      $('title-err').textContent = '部屋を作れませんでした。インターネット接続を確認してね';
      return;
    }
  }
  if (!net) { $('title-err').textContent = '部屋を作れませんでした。もう一度ためしてね'; return; }
  G.net = net; G.isHost = true; G.solo = false; G.myId = net.myId; G.myReady = true;
  G.lobby = { course: 0, players: [{ id: G.myId, name: G.name, char: G.myChar, ready: true, host: true }], inRace: false };
  net.on('join', (id) => {
    if (G.lobby.players.length >= MAX_PLAYERS) { net.send(id, { t: 'full' }); net.kick(id); }
  });
  net.on('data', (d, id) => hostOnData(d, id));
  net.on('leave', (id) => hostOnLeave(id));
  net.on('error', () => {});
  $('title-err').textContent = '';
  show('lobby'); renderLobby();
}

function hostOnData(d, id) {
  if (!d || typeof d !== 'object') return;
  const L = G.lobby;
  switch (d.t) {
    case 'hello': {
      if (L.players.find((p) => p.id === id)) return;
      if (L.players.length >= MAX_PLAYERS) { G.net.send(id, { t: 'full' }); G.net.kick(id); return; }
      const ch = Math.min(CHARS.length - 1, Math.max(0, d.char | 0));
      L.players.push({ id, name: String(d.name || 'ゲスト').slice(0, 8), char: ch, ready: false, host: false });
      broadcastLobby();
      break;
    }
    case 'pick': {
      const p = L.players.find((x) => x.id === id);
      if (p) { p.char = Math.min(CHARS.length - 1, Math.max(0, d.char | 0)); p.ready = !!d.ready; broadcastLobby(); }
      break;
    }
    case 's': if (G.race && d.st && d.st.id === id) applyState(d.st); break;
    case 'ev':
      if (G.race && d.ev) { handleEvent(d.ev); G.net.broadcast({ t: 'ev', ev: d.ev }, id); }
      break;
  }
}

function hostOnLeave(id) {
  const p = G.lobby.players.find((x) => x.id === id);
  G.lobby.players = G.lobby.players.filter((x) => x.id !== id);
  if (G.race) { removeKart(id); if (p) toast(`${p.name}が退出しました`); }
  broadcastLobby();
}

async function doJoin() {
  if (!checkName()) { show('title'); $('title-err').textContent = 'なまえを入れてね'; return; }
  const code = $('in-code').value.trim().toUpperCase();
  if (code.length !== 4) { $('join-err').textContent = '4文字の部屋コードを入れてね'; return; }
  leaveRoom(false);
  $('join-err').textContent = '接続中…';
  const net = new Net();
  net.on('data', (d) => { if (G.net === net) clientOnData(d); });
  net.on('hostLost', () => { if (G.net === net) lostConnection('部屋との接続が切れました'); });
  try { await net.join(code); } catch (e) {
    net.close();
    $('join-err').textContent = e && e.type === 'peer-unavailable'
      ? '部屋が見つかりません。コードを確認してね' : '接続できませんでした。もう一度ためしてね';
    return;
  }
  G.net = net; G.isHost = false; G.solo = false; G.myId = net.myId; G.code = code; G.myReady = false;
  G.lobby = { course: 0, players: [], inRace: false };
  net.toHost({ t: 'hello', name: G.name, char: G.myChar });
  $('join-err').textContent = '';
  show('lobby'); renderLobby();
}

function clientOnData(d) {
  if (!d || typeof d !== 'object') return;
  switch (d.t) {
    case 'lobby':
      G.lobby = d.lobby;
      if (UI.screen === 'lobby') renderLobby();
      break;
    case 'full': lostConnection('部屋がいっぱいです（4人まで）'); break;
    case 'start': startRace(d); break;
    case 'S': if (G.race) for (const st of d.l) applyState(st); break;
    case 'ev': if (G.race) handleEvent(d.ev); break;
    case 'results': if (G.race) showResults(d.list); break;
    case 'toLobby':
      endRace(); G.myReady = false; sendPick();
      show('lobby'); renderLobby();
      if (d.aborted) showOverlay('親がレースを終了しました');
      break;
  }
}

function leaveRoom(toTitle = true) {
  endRace();
  if (G.net) { const n = G.net; G.net = null; n.close(); }
  G.solo = false; G.isHost = false;
  if (toTitle) show('title');
}

function lostConnection(msg) {
  leaveRoom(true);
  showOverlay(msg);
}

function tryStart() {
  const L = G.lobby;
  if (!L.players.every((p) => p.host || p.ready)) { $('lobby-err').textContent = '全員の準備OKを待っています'; return; }
  $('lobby-err').textContent = '';
  const humans = L.players.map((p) => ({ id: p.id, name: p.name, char: p.char, cpu: false }));
  const used = new Set(humans.map((h) => h.char));
  const pool = shuffle(CHARS.map((c, i) => i).filter((i) => !used.has(i)));
  const cpus = [];
  while (humans.length + cpus.length < MAX_PLAYERS) {
    const ci = pool.length ? pool.shift() : Math.floor(Math.random() * CHARS.length);
    cpus.push({ id: 'cpu' + cpus.length, name: CHARS[ci].name, char: ci, cpu: true });
  }
  const roster = [...cpus, ...shuffle(humans)].map((r, i) => ({ ...r, slot: i }));
  const msg = { t: 'start', track: L.course, roster };
  L.inRace = true;
  G.net?.broadcast({ t: 'lobby', lobby: L });
  G.net?.broadcast(msg);
  startRace(msg);
}

function goLobby(aborted = false) {
  const L = G.lobby;
  L.inRace = false;
  for (const p of L.players) if (!p.host) p.ready = false;
  endRace();
  G.net?.broadcast({ t: 'toLobby', aborted });
  show('lobby');
  broadcastLobby();
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- レース ----------
function startRace(msg) {
  endRace();
  hideScreens();
  const def = TRACKS[msg.track] || TRACKS[0];
  const track = new Track(def);
  const th = def.theme;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(th.sky);
  scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
  scene.add(new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]));
  const sun = new THREE.DirectionalLight(0xffffff, th.sun);
  sun.position.set(200, 300, 100); scene.add(sun);
  scene.add(track.build());

  const R = {
    scene, track, def, karts: new Map(), list: [], ranked: [], me: null,
    t: -4, started: false, lastCount: 0, holdStart: null, driftArm: false,
    ents: new Map(), entSeq: 0, boxes: [], pads: [], bursts: [],
    sendT: 0, msgT: 0, toastT: 0, resultsAt: null, timeoutAt: null, done: false,
    camH: 0, camInit: true, paused: false,
  };
  G.race = R;

  for (const r of msg.roster) {
    const ch = CHARS[r.char] || CHARS[0];
    const k = new Kart({ id: r.id, name: r.name, char: ch, cpu: r.cpu, controlled: r.id === G.myId || (G.isHost && r.cpu) });
    k.charIdx = r.char;
    k.place(track, r.slot);
    k.mesh = buildKartMesh(ch);
    if (r.id !== G.myId) k.mesh.add(makeNameTag(r.cpu ? `${r.name}(CPU)` : r.name, ch.color));
    if (r.cpu) { k.ai.skill = 0.9 + Math.random() * 0.06; k.maxMul = k.ai.skill; k.ai.itemWait = 1 + Math.random() * 3; }
    k.onBoost = (kk) => { if (kk === R.me) A.sfx.boost(); };
    k.onHop = (kk) => { if (kk === R.me) A.sfx.jump(); };
    k.onLap = (kk) => onLap(kk);
    scene.add(k.mesh);
    R.karts.set(k.id, k); R.list.push(k);
  }
  R.me = R.karts.get(G.myId) || null;
  if (R.me) R.camH = R.me.h;

  for (const t of def.boxes) {
    const i = Math.floor(t * track.N);
    for (let j = 0; j < 4; j++) {
      const lat = (j - 1.5) * track.hw * 0.4;
      const x = track.px[i] + track.nx[i] * lat, z = track.pz[i] + track.nz[i] * lat;
      const m = buildCrystal(); m.position.set(x, 0, z); scene.add(m);
      R.boxes.push({ x, z, active: true, respawn: 0, mesh: m });
    }
  }
  for (const [t, lat] of def.pads) {
    const i = Math.floor(t * track.N);
    const x = track.px[i] + track.nx[i] * lat, z = track.pz[i] + track.nz[i] * lat;
    const m = buildPad(); m.position.set(x, 0, z); m.rotation.y = track.heading(i); scene.add(m);
    R.pads.push({ x, z, h: track.heading(i) });
  }

  prepareMinimap(R);
  rank(R);
  $('hud').classList.remove('hidden');
  $('pause').classList.add('hidden');
  $('hud-msg').textContent = ''; $('hud-toast').textContent = '';
  A.engineOn();
}

function endRace() {
  const R = G.race;
  if (!R) return;
  G.race = null;
  R.scene.traverse((o) => {
    o.geometry?.dispose?.();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) { m.map?.dispose?.(); m.emissiveMap?.dispose?.(); m.dispose?.(); }
  });
  $('hud').classList.add('hidden');
  A.engineOff();
}

function removeKart(id) {
  const R = G.race;
  const k = R?.karts.get(id);
  if (!k) return;
  R.scene.remove(k.mesh);
  R.karts.delete(id);
  R.list = R.list.filter((x) => x !== k);
  R.ranked = R.ranked.filter((x) => x !== k);
}

function onLap(k) {
  const R = G.race;
  if (k === R.me && !k.finished) {
    if (k.lap === LAPS) { showMsg('FINAL LAP!', 1.6); A.sfx.lap(); }
    else if (k.lap > 1 && k.lap < LAPS) { toast(`LAP ${k.lap}/${LAPS}`); A.sfx.lap(); }
  }
  if (k.lap > LAPS && !k.finished) finishKart(k);
}

function finishKart(k) {
  const R = G.race;
  recordFinish(k.id, R.t);
  sendEvent({ type: 'finish', id: k.id, time: R.t });
  if (k === R.me) {
    rank(R);
    A.sfx.finish();
    showMsg('ゴール！', 3);
    toast(`${k.rank + 1}位でゴール！`);
  }
}

function recordFinish(id, time) {
  const k = G.race.karts.get(id);
  if (!k || k.finished) return;
  k.finished = true; k.finishTime = time;
}

function sendEvent(ev) {
  if (G.solo || !G.net) return;
  if (G.isHost) G.net.broadcast({ t: 'ev', ev });
  else G.net.toHost({ t: 'ev', ev });
}

function handleEvent(ev) {
  const R = G.race;
  if (!R || !ev) return;
  switch (ev.type) {
    case 'box': {
      const b = R.boxes[ev.i];
      if (b) { b.active = false; b.respawn = 3; b.mesh.visible = false; }
      break;
    }
    case 'spawn': spawnEntity(ev.e, false); break;
    case 'hit': {
      removeEntity(ev.eid, true);
      const v = R.karts.get(ev.victim);
      if (ev.by === G.myId && ev.victim !== G.myId && v) toast(ev.blocked ? `${v.name}にふせがれた！` : `${v.name}にヒット！`);
      break;
    }
    case 'finish': recordFinish(ev.id, ev.time); break;
  }
}

// ---------- アイテム ----------
function rollItem(k) {
  const R = G.race;
  const n = R.list.length;
  const r = Math.min(3, Math.round(k.rank * 3 / Math.max(1, n - 1)));
  const tbl = ITEM_TABLE[r];
  let sum = 0;
  for (const v of Object.values(tbl)) sum += v;
  let x = Math.random() * sum;
  for (const [key, v] of Object.entries(tbl)) { x -= v; if (x <= 0) return key; }
  return 'turbo';
}

function useItem(k, back) {
  const R = G.race;
  const it = k.item;
  if (!it || k.rouletteT > 0) return;
  const fx = Math.sin(k.h), fz = Math.cos(k.h);
  const id = `${k.id}#${++R.entSeq}`;
  const mine = k === R.me;
  switch (it) {
    case 'turbo': k.boost(1.4); k.item = null; break;
    case 'turbo3': k.boost(1.4); if (--k.itemCount <= 0) k.item = null; break;
    case 'shield': k.shieldT = 6; k.item = null; if (mine) A.sfx.shield(); break;
    case 'slime':
      spawnEntity({ id, kind: 'slime', owner: k.id, x: k.x - fx * 3.4, z: k.z - fz * 3.4, h: k.h, sp: 0 }, true);
      k.item = null; if (mine) A.sfx.throw();
      break;
    case 'bomb':
      spawnEntity({ id, kind: 'bomb', owner: k.id, x: k.x + fx * (back ? -3.4 : 3.4), z: k.z + fz * (back ? -3.4 : 3.4),
        h: back ? k.h + Math.PI : k.h, sp: back ? 35 : Math.max(70, k.speed + 35) }, true);
      k.item = null; if (mine) A.sfx.throw();
      break;
    case 'seeker': {
      const i = R.ranked.indexOf(k);
      const target = i > 0 ? R.ranked[i - 1] : R.ranked[1];
      spawnEntity({ id, kind: 'seeker', owner: k.id, x: k.x + fx * 3.4, z: k.z + fz * 3.4, h: k.h, sp: 60, target: target ? target.id : null }, true);
      k.item = null; if (mine) A.sfx.throw();
      break;
    }
  }
}

function spawnEntity(e, local) {
  const R = G.race;
  if (!e || R.ents.has(e.id)) return;
  const ent = { ...e, age: 0, idx: -1, bounces: 0, mesh: buildEntityMesh(e.kind) };
  ent.mesh.position.set(e.x, 0, e.z);
  R.scene.add(ent.mesh);
  R.ents.set(e.id, ent);
  if (local) sendEvent({ type: 'spawn', e });
}

function removeEntity(id, burst) {
  const R = G.race;
  const e = R.ents.get(id);
  if (!e) return;
  R.scene.remove(e.mesh);
  R.ents.delete(id);
  if (burst) addBurst(e.x, e.z, e.kind === 'slime' ? 0x6fdc4a : e.kind === 'seeker' ? 0xffe14d : 0xff7a1a);
}

function addBurst(x, z, color) {
  const R = G.race;
  const m = buildBurst(color);
  m.position.set(x, 1, z);
  R.scene.add(m);
  R.bursts.push({ m, t: 0 });
}

function hitKart(k, e) {
  const R = G.race;
  const blocked = k.shieldT > 0;
  if (blocked) k.shieldT = 0;
  else {
    k.spinT = e.kind === 'slime' ? 0.9 : 1.2;
    k.speed *= e.kind === 'slime' ? 0.4 : 0.2;
    k.drifting = false; k.driftCharge = 0;
  }
  removeEntity(e.id, true);
  sendEvent({ type: 'hit', eid: e.id, victim: k.id, by: e.owner, blocked });
  if (k === R.me) {
    blocked ? A.sfx.shield() : A.sfx.hit();
    toast(blocked ? 'バリアでふせいだ！' : `${ITEMS[e.kind].name}に当たった！`);
  } else if (e.owner === G.myId) {
    toast(blocked ? `${k.name}にふせがれた！` : `${k.name}にヒット！`);
  }
}

function updateEntities(dt) {
  const R = G.race, tr = R.track;
  for (const e of [...R.ents.values()]) {
    e.age += dt;
    if (e.kind === 'bomb') {
      e.x += Math.sin(e.h) * e.sp * dt; e.z += Math.cos(e.h) * e.sp * dt;
      e.idx = tr.nearest(e.x, e.z, e.idx);
      const lat = tr.lateral(e.x, e.z, e.idx), lim = tr.hw + 6.5;
      if (Math.abs(lat) > lim) {
        const s = Math.sign(lat);
        e.x -= tr.nx[e.idx] * (Math.abs(lat) - lim) * s; e.z -= tr.nz[e.idx] * (Math.abs(lat) - lim) * s;
        e.h = 2 * tr.heading(e.idx) - e.h;
        if (++e.bounces > 4) { removeEntity(e.id, true); continue; }
      }
      if (e.age > 6) { removeEntity(e.id, true); continue; }
      e.mesh.userData.spin.rotation.x += dt * 10;
    } else if (e.kind === 'seeker') {
      const t = R.karts.get(e.target);
      if (t) {
        const d = wrapAngle(Math.atan2(t.x - e.x, t.z - e.z) - e.h);
        e.h += Math.max(-4.5 * dt, Math.min(4.5 * dt, d));
      }
      e.x += Math.sin(e.h) * e.sp * dt; e.z += Math.cos(e.h) * e.sp * dt;
      if (e.age > 10) { removeEntity(e.id, true); continue; }
      e.mesh.userData.spin.rotation.z += dt * 8;
    } else if (e.kind === 'slime' && e.age > 90) { removeEntity(e.id, false); continue; }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.h;
  }
  if (R.t < 0) return;
  for (const k of R.list) {
    if (!k.controlled) continue;
    for (const e of R.ents.values()) {
      if (e.owner === k.id && e.age < 0.7) continue;
      const r = e.kind === 'slime' ? 2.0 : 2.3;
      if ((k.x - e.x) ** 2 + (k.z - e.z) ** 2 < r * r) { hitKart(k, e); break; }
    }
  }
}

// ---------- 毎フレームの処理 ----------
function myInput(R) {
  const left = isDown('ArrowLeft', 'KeyA', 'PadLeft'), right = isDown('ArrowRight', 'KeyD', 'PadRight');
  const drift = isDown('Space', 'ShiftLeft', 'ShiftRight', 'PadDrift');
  if (wasPressed('Space', 'ShiftLeft', 'ShiftRight', 'PadDrift')) R.driftArm = true;
  if (!drift) R.driftArm = false;
  const keySteer = (left ? 1 : 0) - (right ? 1 : 0);
  return {
    up: isDown('ArrowUp', 'KeyW', 'PadGas'), down: isDown('ArrowDown', 'KeyS', 'PadBrake'),
    steer: keySteer || pad.steer,
    drift, driftPressed: R.driftArm,
    item: wasPressed('KeyX', 'KeyE', 'PadItem'),
    back: isDown('ArrowDown', 'KeyS', 'PadBack'),
  };
}

function rank(R) {
  R.ranked = [...R.list].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.prog - a.prog;
  });
  R.ranked.forEach((k, i) => { k.rank = i; });
}

function updateRace(dt) {
  const R = G.race;
  R.t += dt;
  const me = R.me;
  if (R.t < 0) {
    const n = Math.ceil(-R.t);
    if (n <= 3 && n !== R.lastCount) { R.lastCount = n; showMsg(String(n), 0.9); A.sfx.count(); }
    if (me) {
      const up = isDown('ArrowUp', 'KeyW', 'PadGas');
      if (up && R.holdStart === null) R.holdStart = R.t;
      if (!up) R.holdStart = null;
    }
  } else if (!R.started) {
    R.started = true;
    showMsg('GO!', 1); A.sfx.go();
    if (me && R.holdStart !== null) {
      if (R.holdStart >= -1.1 && R.holdStart <= -0.15) { me.boost(1.1); toast('スタートダッシュ！'); }
      else if (R.holdStart < -2.0) { me.stallT = 0.9; toast('エンスト…はやすぎ！'); }
    }
    for (const k of R.list) if (k.cpu && k.controlled && Math.random() < 0.4) k.boost(0.9);
  }
  const racing = R.t >= 0;

  for (const k of R.list) {
    if (!k.controlled) { smoothRemote(k, dt); continue; }
    if (!racing) continue;
    const human = k === me && !k.finished && !TEST.auto;
    const inp = human ? myInput(R) : aiInput(k, R.track, dt);
    k.update(dt, inp, R.track);
    if (k === me && k.drifting) R.driftArm = false;
    if (k.rouletteT > 0) {
      k.rouletteT -= dt;
      if (k.rouletteT <= 0 && k.pendingItem) {
        k.item = k.pendingItem; k.itemCount = k.item === 'turbo3' ? 3 : 1; k.pendingItem = null;
      }
    }
    if (human) { if (inp.item && !R.paused) useItem(k, inp.back); }
    else if (k.cpu && k.item && k.rouletteT <= 0) {
      k.ai.itemT += dt;
      if (k.ai.itemT > k.ai.itemWait) { useItem(k, false); k.ai.itemT = 0; k.ai.itemWait = 1 + Math.random() * 4; }
    }
  }

  if (racing) { collide(R); pickups(R, dt); pads(R); }
  updateEntities(dt);
  for (const b of R.boxes) {
    if (!b.active) { b.respawn -= dt; if (b.respawn <= 0) { b.active = true; b.mesh.visible = true; } }
    b.mesh.userData.gem.rotation.y += dt * 1.6;
    b.mesh.userData.gem.position.y = 1.6 + Math.sin(R.t * 3 + b.x) * 0.2;
    b.mesh.userData.ring.rotation.z += dt;
  }
  for (const b of [...R.bursts]) {
    b.t += dt;
    b.m.scale.setScalar(1 + b.t * 9);
    b.m.material.opacity = Math.max(0, 0.7 - b.t * 1.4);
    if (b.t > 0.5) { R.scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); R.bursts.splice(R.bursts.indexOf(b), 1); }
  }
  rank(R);
  if (G.isHost && racing) { rubberBand(R); hostCheckResults(R); }
  netSend(R, dt);
  updateVisuals(R, dt);
  updateCamera(R, dt);
  updateHUD(R, dt);
  drawMinimap(R);
  if (me) A.engineUpdate(Math.min(1.3, Math.abs(me.speed) / me.stats.max), me.boostT > 0);
}

function collide(R) {
  const L = R.list;
  for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
    const ka = L[a], kb = L[b];
    if (!ka.controlled && !kb.controlled) continue;
    const dx = kb.x - ka.x, dz = kb.z - ka.z, d2 = dx * dx + dz * dz;
    if (d2 > 6.25 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), ov = 2.5 - d, nx = dx / d, nz = dz / d;
    const wa = ka.stats.weight, wb = kb.stats.weight;
    if (ka.controlled) { const s = wb / (wa + wb); ka.x -= nx * ov * s; ka.z -= nz * ov * s; ka.speed *= 0.985; }
    if (kb.controlled) { const s = wa / (wa + wb); kb.x += nx * ov * s; kb.z += nz * ov * s; kb.speed *= 0.985; }
    if ((ka === R.me || kb === R.me) && ov > 0.4) A.sfx.bump();
  }
}

function pickups(R) {
  R.boxes.forEach((b, i) => {
    if (!b.active) return;
    for (const k of R.list) {
      if (!k.controlled) continue;
      if ((k.x - b.x) ** 2 + (k.z - b.z) ** 2 < 2.8 * 2.8) {
        b.active = false; b.respawn = 3; b.mesh.visible = false;
        addBurst(b.x, b.z, 0x9be7ff);
        sendEvent({ type: 'box', i });
        if (!k.item && k.rouletteT <= 0) {
          k.rouletteT = 1.1; k.pendingItem = rollItem(k);
          if (k === R.me) A.sfx.item();
        }
        break;
      }
    }
  });
}

function pads(R) {
  for (const k of R.list) {
    if (!k.controlled || k.padCool > 0) continue;
    for (const p of R.pads) {
      const dx = k.x - p.x, dz = k.z - p.z;
      const along = dx * Math.sin(p.h) + dz * Math.cos(p.h);
      const lat = dx * Math.cos(p.h) - dz * Math.sin(p.h);
      if (Math.abs(along) < 3.2 && Math.abs(lat) < 2.6) { k.boost(1.0); k.padCool = 0.6; break; }
    }
  }
}

function rubberBand(R) {
  let best = -Infinity;
  for (const k of R.list) if (!k.cpu) best = Math.max(best, k.prog);
  if (best === -Infinity) return;
  for (const k of R.list) {
    if (!k.cpu || !k.controlled) continue;
    const diff = k.prog - best;
    k.maxMul = k.ai.skill * (diff > 80 ? 0.88 : diff < -120 ? 1.08 : 1);
  }
}

function hostCheckResults(R) {
  if (R.done) return;
  const humans = R.list.filter((k) => !k.cpu);
  const fin = humans.filter((k) => k.finished);
  if (fin.length && R.timeoutAt === null) R.timeoutAt = R.t + 30;
  if (humans.length && fin.length === humans.length && R.resultsAt === null) R.resultsAt = R.t + 3;
  if ((R.resultsAt !== null && R.t >= R.resultsAt) || (R.timeoutAt !== null && R.t >= R.timeoutAt)) {
    R.done = true;
    const list = R.ranked.map((k) => ({ id: k.id, name: k.name, char: k.charIdx, cpu: k.cpu, time: k.finished ? k.finishTime : null }));
    G.net?.broadcast({ t: 'results', list });
    showResults(list);
  }
}

// ---------- 通信（位置の送受信） ----------
const r2 = (v) => Math.round(v * 100) / 100;
function pack(k) {
  return {
    id: k.id, x: r2(k.x), z: r2(k.z), h: Math.round(k.h * 1000) / 1000, sp: r2(k.speed), p: r2(k.prog), lap: k.lap,
    f: (k.spinT > 0 ? 1 : 0) | (k.drifting ? 2 : 0) | (k.boostT > 0 ? 4 : 0) | (k.shieldT > 0 ? 8 : 0) | (k.hopT > 0 ? 16 : 0),
    d: k.driftDir, c: k.driftLevel(),
  };
}

function applyState(st) {
  const R = G.race;
  const k = R && st && R.karts.get(st.id);
  if (!k || k.controlled) return;
  k.lastRaw = st;
  if (!k.net) { k.x = st.x; k.z = st.z; k.h = st.h; }
  k.net = { ...st, t: performance.now() };
  k.prog = st.p; k.lap = st.lap;
  k.vSpin = !!(st.f & 1); k.drifting = !!(st.f & 2); k.driftDir = st.d; k.vLevel = st.c;
  k.vBoost = !!(st.f & 4); k.shieldT = (st.f & 8) ? 1 : 0;
  const hopping = !!(st.f & 16);
  if (hopping && !k.vHop && k.hopT <= 0) k.hopT = HOP_TIME;
  k.vHop = hopping;
}

function smoothRemote(k, dt) {
  const n = k.net;
  if (!n) return;
  const age = Math.min(0.2, (performance.now() - n.t) / 1000);
  const tx = n.x + Math.sin(n.h) * n.sp * age, tz = n.z + Math.cos(n.h) * n.sp * age;
  if ((tx - k.x) ** 2 + (tz - k.z) ** 2 > 400) { k.x = tx; k.z = tz; k.h = n.h; }
  const a = 1 - Math.exp(-dt * 12);
  k.x += (tx - k.x) * a; k.z += (tz - k.z) * a;
  k.h += wrapAngle(n.h - k.h) * a;
  k.speed = n.sp;
  k.spinAngle = k.vSpin ? k.spinAngle + dt * 13 : 0;
}

function netSend(R, dt) {
  if (G.solo || !G.net) return;
  R.sendT -= dt;
  if (R.sendT > 0) return;
  R.sendT = 0.05;
  if (G.isHost) {
    const all = R.list.map((k) => (k.controlled ? pack(k) : k.lastRaw)).filter(Boolean);
    for (const id of G.net.conns.keys()) G.net.send(id, { t: 'S', l: all.filter((s) => s.id !== id) });
  } else if (R.me) G.net.toHost({ t: 's', st: pack(R.me) });
}

// ---------- 見た目・カメラ・HUD ----------
function updateVisuals(R, dt) {
  for (const k of R.list) {
    const m = k.mesh, u = m.userData;
    if (!k.controlled && k.hopT > 0) k.hopT -= dt;
    const hop = k.hopT > 0 ? Math.sin((HOP_TIME - k.hopT) / HOP_TIME * Math.PI) * 1.3 : 0;
    m.position.set(k.x, hop, k.z);
    m.rotation.y = k.h + (k.drifting ? k.driftDir * 0.38 : 0);
    u.body.rotation.y = k.spinAngle;
    for (const w of u.wheels) w.rotation.x += k.speed * dt / 0.48;
    animateRacer(u, k.hopT > 0 ? 0 : k.speed, R.t, dt, k);
    const boosting = k.controlled ? k.boostT > 0 : k.vBoost;
    u.flame.visible = boosting;
    if (boosting) u.flame.scale.setScalar(0.8 + Math.random() * 0.5);
    const lv = k.controlled ? k.driftLevel() : (k.drifting ? k.vLevel : 0);
    for (const s of u.sparks) {
      s.visible = lv > 0;
      if (lv > 0) { s.material.color.setHex(SPARK[lv]); s.scale.setScalar(0.6 + Math.random() * 0.8); }
    }
    u.shield.visible = k.shieldT > 0;
  }
}

function updateCamera(R, dt) {
  const k = R.me || R.ranked[0];
  if (!k) return;
  R.camH += wrapAngle(k.h - R.camH) * (1 - Math.exp(-dt * 6));
  const dx = Math.sin(R.camH), dz = Math.cos(R.camH);
  const tx = k.x - dx * 8.5, tz = k.z - dz * 8.5, ty = 3.8;
  if (R.camInit) { camera.position.set(tx, ty, tz); R.camInit = false; camera.fov = 68; }
  else {
    const a = 1 - Math.exp(-dt * 10);
    camera.position.x += (tx - camera.position.x) * a;
    camera.position.y += (ty - camera.position.y) * a;
    camera.position.z += (tz - camera.position.z) * a;
  }
  camera.lookAt(k.x + dx * 4, 1.5, k.z + dz * 4);
  const fov = 68 + Math.max(0, k.speed) / k.stats.max * 6 + (k.boostT > 0 ? 8 : 0);
  camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 4));
  camera.updateProjectionMatrix();
}

function setText(id, v) { const e = $(id); if (e._v !== v) { e._v = v; e.textContent = v; } }
function setHTML(id, v) { const e = $(id); if (e._h !== v) { e._h = v; e.innerHTML = v; } }
function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
function showMsg(text, dur) { const R = G.race; if (!R) return; setText('hud-msg', text); R.msgT = dur; }
function toast(text) {
  const R = G.race;
  if (!R) { $('lobby-err').textContent = text; return; }
  setText('hud-toast', text); R.toastT = 2;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = Object.values(ITEMS).map((i) => i.icon);

function updateHUD(R, dt) {
  const k = R.me;
  if (R.msgT > 0) { R.msgT -= dt; if (R.msgT <= 0) setText('hud-msg', ''); }
  if (R.toastT > 0) { R.toastT -= dt; if (R.toastT <= 0) setText('hud-toast', ''); }
  if (!k) return;
  setText('hud-lap', `LAP ${Math.max(1, Math.min(LAPS, k.lap))}/${LAPS}`);
  setText('hud-time', fmtTime(k.finished ? k.finishTime : Math.max(0, R.t)));
  setHTML('hud-rank', `${k.rank + 1}<small>位</small>`);
  if (k.rouletteT > 0) {
    setText('hud-item-icon', ICONS[Math.floor(R.t * 14) % ICONS.length]);
    setText('hud-item-name', '');
  } else if (k.item) {
    setText('hud-item-icon', ITEMS[k.item].icon + (k.item === 'turbo3' ? `×${k.itemCount}` : ''));
    setText('hud-item-name', ITEMS[k.item].name + '（X）');
  } else { setText('hud-item-icon', ''); setText('hud-item-name', ''); }
  setText('hud-speed', `${Math.round(Math.abs(k.speed) * 3.2)} km/h`);
  const lv = k.driftLevel();
  setHTML('hud-drift', lv ? `<span style="color:#${SPARK[lv].toString(16).padStart(6, '0')}">ミニターボ ${'★'.repeat(lv)}</span>` : '');
  setHTML('hud-ranklist', R.ranked.map((x, i) =>
    `<div style="${x === k ? 'color:#ffd84a;font-weight:800' : ''}">${i + 1}. ${esc(x.name)}${x.cpu ? '(CPU)' : ''}${x.finished ? ' 🏁' : ''}</div>`).join(''));
}

function prepareMinimap(R) {
  const tr = R.track, b = tr.bounds;
  const size = 200, pad = 16;
  const sc = (size - pad * 2) / Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
  const ox = pad + ((size - pad * 2) - (b.maxX - b.minX) * sc) / 2 - b.minX * sc;
  const oz = pad + ((size - pad * 2) - (b.maxZ - b.minZ) * sc) / 2 - b.minZ * sc;
  const bg = document.createElement('canvas'); bg.width = bg.height = size;
  const c = bg.getContext('2d');
  c.lineJoin = 'round'; c.lineCap = 'round';
  const path = () => { c.beginPath(); for (let i = 0; i <= tr.N; i++) { const j = i % tr.N; const x = ox + tr.px[j] * sc, y = oz + tr.pz[j] * sc; i ? c.lineTo(x, y) : c.moveTo(x, y); } };
  path(); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 9; c.stroke();
  path(); c.strokeStyle = '#555b66'; c.lineWidth = 6; c.stroke();
  const sx = ox + tr.px[0] * sc, sy = oz + tr.pz[0] * sc;
  c.fillStyle = '#fff'; c.fillRect(sx - 4, sy - 4, 8, 8);
  R.mini = { bg, sc, ox, oz, ctx: $('minimap').getContext('2d') };
}

function drawMinimap(R) {
  const m = R.mini;
  if (!m) return;
  const c = m.ctx;
  c.clearRect(0, 0, 200, 200);
  c.drawImage(m.bg, 0, 0);
  for (const k of [...R.list].sort((a) => (a === R.me ? 1 : -1))) {
    const x = m.ox + k.x * m.sc, y = m.oz + k.z * m.sc;
    c.beginPath(); c.arc(x, y, k === R.me ? 6 : 4.5, 0, Math.PI * 2);
    c.fillStyle = '#' + k.char.color.toString(16).padStart(6, '0'); c.fill();
    c.lineWidth = 2; c.strokeStyle = k === R.me ? '#fff' : 'rgba(0,0,0,.6)'; c.stroke();
  }
}

// ---------- 結果・ポーズ ----------
function showResults(list) {
  const R = G.race;
  if (R) R.done = true;
  const ol = $('result-list');
  ol.innerHTML = '';
  list.forEach((r, i) => {
    const li = document.createElement('li');
    if (r.id === G.myId) li.className = 'me';
    const ch = CHARS[r.char] || CHARS[0];
    li.innerHTML = `<span class="pos">${i + 1}位</span><span class="dot" style="width:16px;height:16px;border-radius:50%;background:#${ch.color.toString(16).padStart(6, '0')}"></span>`
      + `<span>${esc(r.name)}${r.cpu ? '（CPU）' : ''}</span><span class="tm">${r.time != null ? fmtTime(r.time) : '--:--.--'}</span>`;
    ol.append(li);
  });
  $('result-keys').textContent = G.isHost ? 'Enter ロビーにもどる' : '親がロビーにもどすのを待っています…';
  show('results');
  $('hud').classList.add('hidden');
}

function resultsEnter() {
  if (G.isHost) goLobby();
}

function raceKey(e) {
  const R = G.race;
  if (e.code === 'Escape') {
    e.preventDefault();
    R.paused = !R.paused;
    $('pause').classList.toggle('hidden', !R.paused);
    $('pause-text').textContent = G.solo ? 'ロビーにもどります'
      : G.isHost ? '全員のレースが終わってロビーにもどります' : '部屋から退出してタイトルにもどります';
  } else if (e.code === 'Enter' && R.paused) {
    e.preventDefault();
    if (G.isHost) goLobby(!G.solo);
    else leaveRoom(true);
  }
}

// ---------- 開始 ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  pollGamepad(dt);
  if (G.race) {
    updateRace(dt);
    renderer.render(G.race.scene, camera);
  } else {
    updateMenuScene(dt);
    renderer.render(menu.scene, menu.cam);
  }
  pressed.clear();
}

// タブが裏に回っても親のレースが止まらないよう、Workerのタイマーで進める
function startBackgroundTicker() {
  try {
    const src = 'setInterval(() => postMessage(0), 50);';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    let prev = performance.now();
    w.onmessage = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (document.hidden && G.race && !G.solo) { updateRace(dt); last = now; }
    };
  } catch (e) { /* 使えない環境では何もしない */ }
}

function init() {
  startBackgroundTicker();
  $('in-name').value = store.get('tf-name', '');
  $('items-help').innerHTML = Object.entries(ITEMS).map(([k, v]) => `<div>${v.icon} <b>${v.name}</b>：${ITEM_DESC[k]}</div>`).join('');
  const room = new URLSearchParams(location.search).get('room');
  show('title');
  if (room) {
    $('in-code').value = room.toUpperCase().slice(0, 4);
    $('title-err').textContent = `部屋「${$('in-code').value}」に招待されています。なまえを入れて「部屋に入る」を選んでね`;
    if ($('in-name').value) focusAct('gojoin');
  }
  requestAnimationFrame(loop);
}
init();

// 動作確認用
window.__tf = { G, UI, TEST, menu, step: (dt) => G.race && updateRace(dt) };
