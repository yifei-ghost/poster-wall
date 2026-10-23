import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeWeave, makeVinylTop, makeContactShadow, mulberry32 } from './textures.js';

const chrome = new THREE.MeshStandardMaterial({ color: 0xe9edf3, metalness: 1, roughness: 0.14 });
const powder = new THREE.MeshStandardMaterial({ color: 0x17181b, metalness: 0.25, roughness: 0.5 });
const contactTex = makeContactShadow();

function shadowOn(obj, cast = true, receive = true) {
  obj.traverse(o => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

export function contactShadow(w, d, opacity = 0.55) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  m.renderOrder = 1;
  m.userData.noBounds = true;
  return m;
}

// --- Modular steel shelf (two bays, two levels) --------------------------

export function makeShelf() {
  const g = new THREE.Group();
  const BAY = 0.75, BAYS = 2, D = 0.38;
  const W = BAY * BAYS;
  const LEVELS = [0.065, 0.42, 0.745];
  const TUBE_R = 0.0095;
  const x0 = -W / 2, x1 = W / 2;
  const zf = D / 2, zb = -D / 2;

  const tubeGeo = new THREE.CylinderGeometry(TUBE_R, TUBE_R, 1, 16);
  const ballGeo = new THREE.SphereGeometry(TUBE_R * 1.45, 20, 14);
  const tube = (a, b) => {
    const m = new THREE.Mesh(tubeGeo, chrome);
    const dir = new THREE.Vector3().subVectors(b, a);
    m.scale.y = dir.length();
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    g.add(m);
  };
  const ball = (x, y, z) => {
    const m = new THREE.Mesh(ballGeo, chrome);
    m.position.set(x, y, z);
    g.add(m);
  };

  const xs = Array.from({ length: BAYS + 1 }, (_, i) => x0 + i * BAY);
  for (const y of LEVELS) {
    tube(new THREE.Vector3(x0, y, zf), new THREE.Vector3(x1, y, zf));
    tube(new THREE.Vector3(x0, y, zb), new THREE.Vector3(x1, y, zb));
    for (const x of xs) {
      tube(new THREE.Vector3(x, y, zb), new THREE.Vector3(x, y, zf));
      ball(x, y, zf);
      ball(x, y, zb);
    }
  }
  for (const x of xs) {
    for (const z of [zf, zb]) tube(new THREE.Vector3(x, LEVELS[0], z), new THREE.Vector3(x, LEVELS[2], z));
  }
  // Glides
  const glide = new THREE.CylinderGeometry(0.012, 0.016, LEVELS[0] - 0.012, 16);
  for (const x of xs) for (const z of [zf, zb]) {
    const m = new THREE.Mesh(glide, powder);
    m.position.set(x, (LEVELS[0] - 0.012) / 2, z);
    g.add(m);
  }

  const panel = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.003), powder);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const inset = 0.012;
  const T = 0.01;
  // Horizontal panels
  for (const y of LEVELS) panel(W - inset * 2, T, D - inset * 2, 0, y, 0);
  // Back + side panels
  for (let l = 0; l < 2; l++) {
    const yA = LEVELS[l], yB = LEVELS[l + 1];
    const h = yB - yA - inset * 2;
    const ym = (yA + yB) / 2;
    panel(W - inset * 2, h, T, 0, ym, zb + inset);
    panel(T, h, D - inset * 2, x0 + inset, ym, 0);
    panel(T, h, D - inset * 2, x1 - inset, ym, 0);
  }
  // Lower doors with chrome locks
  const yA = LEVELS[0], yB = LEVELS[1];
  for (let b = 0; b < BAYS; b++) {
    const cx = x0 + BAY * (b + 0.5);
    panel(BAY - inset * 2, yB - yA - inset * 2, T, cx, (yA + yB) / 2, zf - inset);
    const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 24), chrome);
    lock.rotation.x = Math.PI / 2;
    lock.position.set(cx, yB - 0.045, zf - inset + 0.008);
    g.add(lock);
  }

  // Books in the open upper compartment
  const bookColors = [0x2b3442, 0xe6e1d6, 0x8b9cb1, 0x3d3f45, 0xcfc8b8, 0xc4542c, 0x5a6b80];
  const rnd = (() => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const stack = (cx, n) => {
    let y = LEVELS[1] + T / 2;
    for (let i = 0; i < n; i++) {
      const h = 0.018 + rnd() * 0.02;
      const w = 0.2 + rnd() * 0.08;
      const d = 0.15 + rnd() * 0.06;
      const m = new THREE.Mesh(
        new RoundedBoxGeometry(w, h, d, 1, 0.002),
        new THREE.MeshStandardMaterial({ color: bookColors[Math.floor(rnd() * bookColors.length)], roughness: 0.75 }),
      );
      m.position.set(cx + (rnd() - 0.5) * 0.03, y + h / 2, 0.02 + (rnd() - 0.5) * 0.02);
      m.rotation.y = (rnd() - 0.5) * 0.08;
      g.add(m);
      y += h;
    }
  };
  stack(x0 + BAY * 0.5, 5);
  stack(x0 + BAY * 1.5 - 0.08, 3);

  shadowOn(g);
  const shadow = contactShadow(W + 0.35, D + 0.3, 0.6);
  g.add(shadow);
  return { group: g, topY: LEVELS[2] + T / 2, width: W, depth: D };
}

// --- Turntable -----------------------------------------------------------

export function makeTurntable() {
  const g = new THREE.Group();
  const PW = 0.46, PH = 0.085, PD = 0.36;

  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x1e1f22, roughness: 0.42, metalness: 0.15 });
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(PW, PH, PD, 4, 0.01), plinthMat);
  plinth.position.y = PH / 2 + 0.018;
  g.add(plinth);

  const footGeo = new THREE.CylinderGeometry(0.026, 0.03, 0.018, 24);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const f = new THREE.Mesh(footGeo, chrome);
    f.position.set(x * (PW / 2 - 0.045), 0.009, z * (PD / 2 - 0.045));
    g.add(f);
  }

  const top = PH + 0.018;
  const platter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.152, 0.152, 0.022, 64),
    new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 1, roughness: 0.32 }),
  );
  platter.position.set(-0.04, top + 0.011, 0);
  g.add(platter);

  const vinyl = new THREE.Group();
  vinyl.position.set(-0.04, top + 0.0235, 0);
  const vinylTop = makeVinylTop();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.003, 96),
    [
      new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: vinylTop, roughness: 0.28, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.3 }),
    ],
  );
  vinyl.add(disc);
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.02, 12), chrome);
  spindle.position.y = 0.008;
  vinyl.add(spindle);
  g.add(vinyl);

  // Tonearm
  const arm = new THREE.Group();
  arm.position.set(0.165, top, -0.1);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.03, 32), chrome);
  base.position.y = 0.015;
  arm.add(base);
  const pivot = new THREE.Group();
  pivot.position.y = 0.04;
  pivot.rotation.y = 0.32;
  arm.add(pivot);
  const tubeLen = 0.23;
  const armTube = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, tubeLen, 12), chrome);
  armTube.rotation.x = Math.PI / 2;
  armTube.position.z = tubeLen / 2;
  pivot.add(armTube);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 0.04), plinthMat);
  head.position.set(-0.004, -0.004, tubeLen + 0.012);
  head.rotation.y = 0.35;
  pivot.add(head);
  const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.03, 24), chrome);
  weight.rotation.x = Math.PI / 2;
  weight.position.z = -0.045;
  pivot.add(weight);
  const rest = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8), chrome);
  rest.position.set(0.035, 0.015, 0.1);
  arm.add(rest);
  g.add(arm);

  // Knob
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 24), chrome);
  knob.position.set(-PW / 2 + 0.04, top + 0.005, PD / 2 - 0.04);
  g.add(knob);

  // Smoked acrylic dust cover, hinged open at the back
  const lidMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a3f48,
    metalness: 0,
    roughness: 0.06,
    transparent: true,
    opacity: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const lid = new THREE.Group();
  const LW = PW + 0.004, LD = PD + 0.004, LH = 0.06, LT = 0.004;
  const lidPanel = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lidMat);
    m.position.set(x, y, z);
    lid.add(m);
  };
  // Pivot on the lid's top back edge so the skirt swings forward, away from the wall
  lidPanel(LW, LT, LD, 0, 0, LD / 2);
  lidPanel(LW, LH, LT, 0, -LH / 2, LD);
  lidPanel(LT, LH, LD, -LW / 2, -LH / 2, LD / 2);
  lidPanel(LT, LH, LD, LW / 2, -LH / 2, LD / 2);
  const PIVOT_Y = top + 0.03;
  const PIVOT_Z = -PD / 2 - 0.008;
  lid.position.set(0, PIVOT_Y, PIVOT_Z);
  lid.rotation.x = -1.42;
  g.add(lid);

  // Hinge brackets bolted to the plinth's back, carrying the lid pivot
  for (const s of [-1, 1]) {
    const x = s * (PW / 2 - 0.07);
    const bracket = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.055, 0.014, 2, 0.003), plinthMat);
    bracket.position.set(x, PIVOT_Y - 0.018, PIVOT_Z + 0.001);
    g.add(bracket);
    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.034, 16), chrome);
    knuckle.rotation.z = Math.PI / 2;
    knuckle.position.set(x, PIVOT_Y, PIVOT_Z);
    g.add(knuckle);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.004, 0.04), plinthMat);
    leaf.position.set(x, 0, 0.02);
    lid.add(leaf);
  }

  shadowOn(g);
  lid.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  g.add(contactShadow(PW + 0.12, PD + 0.12, 0.5));
  return { group: g, vinyl };
}

// --- Stacked glass block lamp -------------------------------------------

export function makeGlassLamp() {
  const g = new THREE.Group();
  const S = 0.15;
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffe4cf,
    metalness: 0,
    roughness: 0.22,
    transmission: 1,
    thickness: 0.03,
    ior: 1.47,
    attenuationColor: new THREE.Color(0xff9a62),
    attenuationDistance: 0.25,
    emissive: new THREE.Color(0xff5a1c),
    emissiveIntensity: 0.18,
    specularIntensity: 1,
  });
  const base = new THREE.Mesh(new RoundedBoxGeometry(S * 0.86, 0.012, S * 0.86, 2, 0.003), powder);
  base.position.y = 0.006;
  g.add(base);

  const N = 7, PT = 0.014, GAP = 0.0055;
  for (let i = 0; i < N; i++) {
    const p = new THREE.Mesh(new RoundedBoxGeometry(S, PT, S, 2, 0.0025), glass);
    p.position.y = 0.012 + PT / 2 + i * (PT + GAP);
    g.add(p);
  }
  const H = 0.012 + N * (PT + GAP);

  // Glowing core seen through the glass
  const hot = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff6a24, emissiveIntensity: 9 });
  const filament = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, S * 0.7, 12), hot);
  filament.rotation.z = Math.PI / 2;
  filament.position.y = H * 0.48;
  g.add(filament);
  const filament2 = filament.clone();
  filament2.position.y = H * 0.62;
  filament2.rotation.y = Math.PI / 2;
  g.add(filament2);
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(S * 0.32, H * 0.5, S * 0.32),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff7b33, emissiveIntensity: 1.3 }),
  );
  core.position.y = H * 0.52;
  g.add(core);

  const light = new THREE.PointLight(0xff7230, 0.9, 0, 2);
  light.position.set(0, H * 0.55, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.near = 0.09;
  light.shadow.bias = -0.002;
  light.shadow.normalBias = 0.01;
  g.add(light);

  base.castShadow = true;
  g.add(contactShadow(S + 0.08, S + 0.08, 0.45));
  return { group: g, light, glass, hot, core, height: H };
}

// --- Seagrass basket -----------------------------------------------------

export function makeBasket() {
  const g = new THREE.Group();
  const { map, bump } = makeWeave();
  const R = 0.8; // radius scale
  const pts = [
    [0.0, 0.0], [0.15, 0.0], [0.168, 0.008], [0.186, 0.05], [0.203, 0.14],
    [0.212, 0.24], [0.21, 0.33], [0.204, 0.41],
  ].map(([r, y]) => new THREE.Vector2(r * R, y));
  const outer = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 96),
    new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 3, roughness: 0.92, side: THREE.FrontSide }),
  );
  g.add(outer);

  const innerMap = map.clone();
  innerMap.needsUpdate = true;
  const inner = new THREE.Mesh(
    new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(0, p.x - 0.008), p.y + 0.006)), 96),
    new THREE.MeshStandardMaterial({ map: innerMap, color: 0x7d776a, bumpMap: bump, bumpScale: 3, roughness: 0.95, side: THREE.BackSide }),
  );
  g.add(inner);

  const ropeMat = new THREE.MeshStandardMaterial({ map: map.clone(), bumpMap: bump, bumpScale: 4, roughness: 0.9 });
  ropeMat.map.repeat.set(10, 0.25);
  ropeMat.map.needsUpdate = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.204 * R, 0.013, 14, 96), ropeMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.41;
  g.add(rim);

  // Rope handles
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 10, 32, Math.PI), ropeMat);
    h.position.set(s * 0.205 * R, 0.36, 0);
    h.rotation.y = Math.PI / 2;
    g.add(h);
  }

  shadowOn(g);
  g.add(contactShadow(0.52, 0.52, 0.7));

  // Rolls stand in a loose fan: each top roughly has its own lane, with a little seeded
  // jitter in lean, depth, height and spin so it reads as a real, casually filled basket.
  const slots = [];
  const N = 8;
  const RIM_Y = 0.41;
  const ROLL_LEN = 0.958;
  const LANE = 0.072;
  const rnd = mulberry32(21);
  for (let i = 0; i < N; i++) {
    const xTop = (i - (N - 1) / 2) * LANE + (rnd() - 0.5) * 0.026;
    const x0 = xTop * 0.2 + (rnd() - 0.5) * 0.02;
    const z = (i % 2 === 0 ? -1 : 1) * (0.012 + rnd() * 0.035);
    const y = rnd() * 0.07; // some rolls rest on others' ends
    const lean = Math.atan((xTop - x0) / ROLL_LEN);
    const tilt = Math.atan((-z * 0.6) / ROLL_LEN) + (rnd() - 0.5) * 0.03;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, 0, -lean, 'XYZ'));
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 1.6));
    slots.push({ pos: new THREE.Vector3(x0, y, z), quat: q });
  }
  return { group: g, slots, rimY: RIM_Y };
}
