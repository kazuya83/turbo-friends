// 見た目の強化（影・空・映り込み・光のにじみ）と画質の切り替え
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SKY = {
  meadow: { elevation: 40, azimuth: 120, turbidity: 2, rayleigh: 0.9, bloom: 0.15, exposure: 0.62, sun: 2.6, hemi: 0.95 },
  desert: { elevation: 28, azimuth: 140, turbidity: 5, rayleigh: 1.6, bloom: 0.18, exposure: 0.58, sun: 2.9, hemi: 0.9 },
  snow: { elevation: 25, azimuth: 200, turbidity: 2, rayleigh: 0.6, bloom: 0.15, exposure: 0.55, sun: 2.2, hemi: 0.9 },
  beach: { elevation: 50, azimuth: 100, turbidity: 2, rayleigh: 1.2, bloom: 0.15, exposure: 0.6, sun: 2.6, hemi: 0.95 },
  city: { elevation: 30, azimuth: 120, bloom: 0.45, threshold: 0.8, exposure: 1.0, sun: 1, hemi: 1, night: true },
};

export const GFX = { high: true };
try { GFX.high = localStorage.getItem('tf-gfx') !== 'low'; } catch (e) { /* 既定は高画質 */ }

let envTex = null;

export function initRenderer(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  applyRendererQuality(renderer);
}

function applyRendererQuality(renderer) {
  renderer.shadowMap.enabled = GFX.high;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, GFX.high ? 1.5 : 1));
}

function environment(renderer) {
  if (!envTex) {
    const pm = new THREE.PMREMGenerator(renderer);
    envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }
  return envTex;
}

// レース用シーンの光・空・影・ポストエフェクトを用意する
export function setupRace(renderer, scene, camera, def) {
  const conf = SKY[def.id] || SKY.meadow;
  const th = def.theme;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1,
    THREE.MathUtils.degToRad(90 - conf.elevation), THREE.MathUtils.degToRad(conf.azimuth));

  const hemi = new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2] * conf.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(conf.night ? 0xaab8ff : 0xfff2dd, th.sun * conf.sun);
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 500;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(sun); scene.add(sun.target);

  let sky = null;
  if (!conf.night) {
    sky = new Sky();
    sky.scale.setScalar(2200);
    const u = sky.material.uniforms;
    u.turbidity.value = conf.turbidity; u.rayleigh.value = conf.rayleigh;
    u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.copy(sunDir);
    scene.add(sky);
    scene.environment = environment(renderer);
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), conf.bloom, 0.3, conf.threshold || 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // 影を落とすもの・受けるもの
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    const transparent = Array.isArray(o.material) ? false : o.material.transparent;
    o.castShadow = !o.userData.noCast && !transparent && !(o.material && o.material.isMeshBasicMaterial);
  });

  const G = {
    scene, sun, sky, composer, bloom,
    apply() {
      sun.castShadow = GFX.high;
      // 高画質は本物の空に合わせて露出を下げ、そのぶん光を強くする
      renderer.toneMappingExposure = GFX.high ? conf.exposure : 1.05;
      sun.intensity = th.sun * (GFX.high ? conf.sun : 1);
      hemi.intensity = th.hemi[2] * (GFX.high ? conf.hemi : 1);
      scene.background = GFX.high && sky ? null : new THREE.Color(th.sky);
      if (sky) sky.visible = GFX.high;
      scene.traverse((o) => {
        if (o.userData.blobShadow) o.visible = !GFX.high;
        if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true;
      });
    },
    // 影は自分のカートのまわりだけ細かく計算する
    follow(x, z) {
      sun.target.position.set(x, 0, z);
      sun.position.set(x + sunDir.x * 250, sunDir.y * 250, z + sunDir.z * 250);
    },
    render() {
      if (GFX.high) composer.render();
      else renderer.render(scene, camera);
    },
    resize(w, h) { composer.setSize(w, h); },
    dispose() { composer.dispose?.(); bloom.dispose?.(); renderer.toneMappingExposure = 1.05; },
  };
  G.apply();
  return G;
}

// 影を付けたあとにシーンへ追加したもの（カート・アイテムなど）の設定
export function prepareObject(obj) {
  obj.traverse((o) => {
    if (o.userData.blobShadow) o.visible = !GFX.high;
    if (!o.isMesh) return;
    const transparent = Array.isArray(o.material) ? false : o.material.transparent;
    o.castShadow = !transparent && !(o.material && o.material.isMeshBasicMaterial);
    o.receiveShadow = true;
  });
}

export function toggleQuality(renderer, raceGfx) {
  GFX.high = !GFX.high;
  try { localStorage.setItem('tf-gfx', GFX.high ? 'high' : 'low'); } catch (e) { /* 保存できなくても続行 */ }
  applyRendererQuality(renderer);
  renderer.setSize(innerWidth, innerHeight);
  raceGfx?.apply();
  raceGfx?.resize(innerWidth, innerHeight);
  return GFX.high;
}
