import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Setup ---------------------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15141a);
scene.fog = new THREE.Fog(0x15141a, 14, 32);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(1.4, 1.6, 9.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0.6, 1.0, 0);
controls.minDistance = 5;
controls.maxDistance = 13;
controls.maxPolarAngle = Math.PI * 0.52;
controls.minPolarAngle = Math.PI * 0.28;
controls.minAzimuthAngle = -Math.PI * 0.42;
controls.maxAzimuthAngle = Math.PI * 0.42;

// --- Lighting ------------------------------------------------------------

const hemi = new THREE.HemisphereLight(0xfff2d9, 0x1a1620, 0.42);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xfff0d0, 1.1);
key.position.set(-3.5, 5.5, 4.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -6;
key.shadow.camera.right = 6;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -5;
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 20;
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.02;
scene.add(key);

const fill = new THREE.DirectionalLight(0x9ab4ff, 0.25);
fill.position.set(5, 3, 3);
scene.add(fill);

// Warm accent light pointing at the wall near the poster area
const accent = new THREE.PointLight(0xffd4a3, 1.2, 10, 2.1);
accent.position.set(0.2, 2.6, 2.6);
scene.add(accent);

// --- Procedural textures -------------------------------------------------

function makePlasterTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // base
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#e9dcc6');
  g.addColorStop(1, '#c7b593');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // noise speckle
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 24;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  // soft stains
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 40 + Math.random() * 90;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(60,40,20,${0.03 + Math.random() * 0.05})`);
    rg.addColorStop(1, 'rgba(60,40,20,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1.2);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeFloorTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // base wood
  ctx.fillStyle = '#3a2a1e';
  ctx.fillRect(0, 0, size, size);
  // planks
  const plankH = 64;
  for (let y = 0; y < size; y += plankH) {
    const shade = 20 + Math.floor(Math.random() * 30);
    ctx.fillStyle = `rgb(${58 + shade},${40 + shade * 0.6},${28 + shade * 0.3})`;
    ctx.fillRect(0, y, size, plankH - 2);
    // grain streaks
    for (let i = 0; i < 10; i++) {
      ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const yy = y + 4 + Math.random() * (plankH - 10);
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(size * 0.3, yy + (Math.random() - 0.5) * 4, size * 0.6, yy + (Math.random() - 0.5) * 4, size, yy + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }
    // dark seam
    ctx.fillStyle = '#1a110a';
    ctx.fillRect(0, y + plankH - 2, size, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeWeaveTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8d6a3e';
  ctx.fillRect(0, 0, size, size);
  const step = 24;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const row = (y / step) | 0;
      const col = (x / step) | 0;
      const over = (row + col) % 2 === 0;
      const grad = ctx.createLinearGradient(x, y, x + step, y + step);
      if (over) {
        grad.addColorStop(0, '#a98052');
        grad.addColorStop(0.5, '#c69864');
        grad.addColorStop(1, '#7a5a35');
      } else {
        grad.addColorStop(0, '#5e4323');
        grad.addColorStop(0.5, '#8e6939');
        grad.addColorStop(1, '#4a3419');
      }
      ctx.fillStyle = grad;
      // rounded rect
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + step - r, y);
      ctx.quadraticCurveTo(x + step, y, x + step, y + r);
      ctx.lineTo(x + step, y + step - r);
      ctx.quadraticCurveTo(x + step, y + step, x + step - r, y + step);
      ctx.lineTo(x + r, y + step);
      ctx.quadraticCurveTo(x, y + step, x, y + step - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// --- Room geometry -------------------------------------------------------

const wallTex = makePlasterTexture();
const floorTex = makeFloorTexture();

const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, metalness: 0.0 });
const wallGeo = new THREE.PlaneGeometry(14, 8);
const wall = new THREE.Mesh(wallGeo, wallMat);
wall.position.set(0, 1.5, 0);
wall.receiveShadow = true;
scene.add(wall);

// Baseboard
const baseGeo = new THREE.BoxGeometry(14, 0.28, 0.1);
const baseMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 });
const baseboard = new THREE.Mesh(baseGeo, baseMat);
baseboard.position.set(0, -2.37, 0.05);
baseboard.receiveShadow = true;
scene.add(baseboard);

// Floor
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75, metalness: 0.0 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -2.5, 4);
floor.receiveShadow = true;
scene.add(floor);

// Picture rail / nail
const nailGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.08, 16);
const nailMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4e, metalness: 0.8, roughness: 0.35 });
const nail = new THREE.Mesh(nailGeo, nailMat);
nail.rotation.x = Math.PI / 2;
nail.position.set(-0.4, 3.0, 0.06);
nail.castShadow = true;
scene.add(nail);

// --- Posters strip texture -----------------------------------------------

const POSTER_COUNT = 8;
const POSTER_W = 1.5;
const POSTER_H = POSTER_W * (162 / 128); // ~1.90

const texLoader = new THREE.TextureLoader();
const strip = await texLoader.loadAsync('./posters-strip.png');
strip.colorSpace = THREE.SRGBColorSpace;
strip.anisotropy = 8;
strip.minFilter = THREE.LinearMipmapLinearFilter;
strip.magFilter = THREE.LinearFilter;

function posterTexture(i) {
  const t = strip.clone();
  t.needsUpdate = true;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1 / POSTER_COUNT, 1);
  t.offset.set(i / POSTER_COUNT, 0);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Build a small "cap" texture for the end of a rolled poster: a tiny slice of the real poster, blurred and tinted — reads as "the end of a roll"
function posterCapTexture(i) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // light paper color
  ctx.fillStyle = '#f1e8d6';
  ctx.fillRect(0, 0, size, size);
  // concentric rings
  for (let r = size * 0.47; r > 2; r -= 3) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(90,70,45,${0.08 + Math.random() * 0.08})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // center shadow
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0.0)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// --- Basket --------------------------------------------------------------

const basketGroup = new THREE.Group();
basketGroup.position.set(3.6, -1.95, 1.3);
scene.add(basketGroup);

const weaveTex = makeWeaveTexture();
const basketMat = new THREE.MeshStandardMaterial({ map: weaveTex, roughness: 0.85 });

// Tapered basket body (wider at top)
const basketBody = new THREE.Mesh(
  new THREE.CylinderGeometry(1.05, 0.78, 1.4, 48, 1, true),
  basketMat,
);
basketBody.position.y = 0;
basketBody.castShadow = true;
basketBody.receiveShadow = true;
basketGroup.add(basketBody);

// Basket rim (thin torus at top)
const basketRim = new THREE.Mesh(
  new THREE.TorusGeometry(1.05, 0.055, 10, 48),
  new THREE.MeshStandardMaterial({ color: 0x5a3f1f, roughness: 0.6 }),
);
basketRim.rotation.x = Math.PI / 2;
basketRim.position.y = 0.7;
basketRim.castShadow = true;
basketGroup.add(basketRim);

// Basket inner floor (just so you don't see through)
const basketFloor = new THREE.Mesh(
  new THREE.CircleGeometry(0.78, 48),
  new THREE.MeshStandardMaterial({ color: 0x2a1a0d, roughness: 1.0 }),
);
basketFloor.rotation.x = -Math.PI / 2;
basketFloor.position.y = -0.6;
basketGroup.add(basketFloor);

// Shadow blob under basket on floor (fake AO)
const blob = new THREE.Mesh(
  new THREE.CircleGeometry(1.3, 32),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
);
blob.rotation.x = -Math.PI / 2;
blob.position.set(basketGroup.position.x, -2.49, basketGroup.position.z);
scene.add(blob);

// --- Rolled posters ------------------------------------------------------

const ROLL_RADIUS = 0.09;
const ROLL_HEIGHT = 1.55;

const posters = []; // { index, state, rolledMesh, flatMesh, ... }

function makeRolledMesh(i) {
  const group = new THREE.Group();

  // The body of the roll — a tall cylinder; wrap part of the poster around it
  // We can't actually wrap a texture into a spiral cheaply, so we fake it:
  // the cylindrical side shows a repeating vertical slice of the poster edge, tinted lighter,
  // and the top is the ring cap. From a few feet away this reads as a rolled poster.
  const sideTex = posterTexture(i).clone();
  sideTex.wrapS = THREE.ClampToEdgeWrapping;
  // Only show a narrow strip wrapped around — gives a subtle visible edge
  sideTex.repeat.set(0.08, 1);
  sideTex.offset.set(i / POSTER_COUNT + 0.02, 0);
  sideTex.needsUpdate = true;

  const sideMat = new THREE.MeshStandardMaterial({
    map: sideTex,
    color: 0xf2e8d4,
    roughness: 0.85,
  });

  const capMat = new THREE.MeshStandardMaterial({
    map: posterCapTexture(i),
    roughness: 0.9,
  });

  // CylinderGeometry: [side, top, bottom] material order
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(ROLL_RADIUS, ROLL_RADIUS, ROLL_HEIGHT, 24, 1),
    [sideMat, capMat, capMat],
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // A tiny flap along the length to suggest the visible edge of the roll
  const flapGeo = new THREE.PlaneGeometry(ROLL_RADIUS * 2 * Math.PI * 0.08, ROLL_HEIGHT * 0.98);
  const flapMat = new THREE.MeshStandardMaterial({
    map: posterTexture(i),
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const flap = new THREE.Mesh(flapGeo, flapMat);
  // Position flap just outside the cylinder, oriented tangent
  flap.position.set(ROLL_RADIUS * 1.001, 0, 0);
  flap.rotation.y = Math.PI / 2;
  group.add(flap);

  group.userData.sideMat = sideMat;
  group.userData.capMat = capMat;
  group.userData.flapMat = flapMat;
  group.userData.body = body;
  return group;
}

function makeFlatMesh(i) {
  const group = new THREE.Group();
  // Paper
  const geo = new THREE.PlaneGeometry(POSTER_W, POSTER_H, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    map: posterTexture(i),
    roughness: 0.82,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
  const paper = new THREE.Mesh(geo, mat);
  paper.castShadow = true;
  paper.receiveShadow = true;
  group.add(paper);
  // Subtle backing so edges catch light
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(POSTER_W + 0.02, POSTER_H + 0.02),
    new THREE.MeshStandardMaterial({ color: 0xf0e9d8, roughness: 0.9 }),
  );
  back.position.z = -0.005;
  group.add(back);
  return group;
}

// Arrange rolled posters inside the basket at different tilts
const basketLocalPositions = [];
for (let i = 0; i < POSTER_COUNT; i++) {
  const t = i / POSTER_COUNT;
  const angle = t * Math.PI * 2;
  const r = 0.4 + ((i * 37) % 10) / 60; // 0.4..0.57
  basketLocalPositions.push({
    pos: new THREE.Vector3(Math.cos(angle) * r, 0.78, Math.sin(angle) * r * 0.6),
    tilt: new THREE.Euler(
      ((i * 13) % 7 - 3) * 0.04,
      0,
      ((i * 29) % 11 - 5) * 0.05,
    ),
  });
}

for (let i = 0; i < POSTER_COUNT; i++) {
  const rolled = makeRolledMesh(i);
  const home = basketLocalPositions[i];
  rolled.position.copy(home.pos);
  rolled.rotation.copy(home.tilt);
  basketGroup.add(rolled);

  const flat = makeFlatMesh(i);
  flat.visible = false;
  // Hangs centered-ish on wall, nail at top-center of poster
  flat.position.set(-0.4, 3.0 - POSTER_H / 2 - 0.03, 0.04);
  scene.add(flat);

  posters.push({
    index: i,
    rolled,
    flat,
    home: {
      pos: home.pos.clone(),
      rot: home.tilt.clone(),
    },
    state: 'rolled', // 'rolled' | 'animatingUp' | 'hanging' | 'animatingDown'
    anim: null,
  });
}

// --- Picking ------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const pickables = [];
posters.forEach(p => {
  // Walk all meshes under the rolled group for picking
  p.rolled.traverse(obj => { if (obj.isMesh) { obj.userData.posterRef = p; pickables.push(obj); } });
  p.flat.traverse(obj => { if (obj.isMesh) { obj.userData.posterRef = p; pickables.push(obj); } });
});

let hangingPoster = null; // the currently hanging poster, if any

function onPointerDown(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  if (!hits.length) return;
  const first = hits[0].object.userData.posterRef;
  if (!first) return;
  if (first.state === 'rolled') {
    hangPoster(first);
  } else if (first.state === 'hanging') {
    rollPoster(first);
  }
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);

// --- Animations ----------------------------------------------------------

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function hangPoster(p) {
  // If something else is hanging, roll it back first
  if (hangingPoster && hangingPoster !== p) {
    rollPoster(hangingPoster);
  }

  p.state = 'animatingUp';
  const rolled = p.rolled;
  // Convert world start pos → scene coords for the flight
  const startWorld = new THREE.Vector3();
  rolled.getWorldPosition(startWorld);
  const startQuat = new THREE.Quaternion();
  rolled.getWorldQuaternion(startQuat);

  // Detach rolled from basket for the flight
  scene.attach(rolled);
  rolled.position.copy(startWorld);
  rolled.quaternion.copy(startQuat);

  const wallTarget = new THREE.Vector3(-0.4, 3.0 - POSTER_H / 2 - 0.03, 0.08);
  const midPoint = new THREE.Vector3(
    (startWorld.x + wallTarget.x) / 2,
    Math.max(startWorld.y, wallTarget.y) + 0.6,
    (startWorld.z + wallTarget.z) / 2 + 0.4,
  );
  const endQuat = new THREE.Quaternion(); // identity: upright, no tilt

  const dur = 0.8;
  let t0 = null;
  p.anim = (now) => {
    if (t0 === null) t0 = now;
    const t = Math.min(1, (now - t0) / dur);
    const e = easeInOut(t);
    // Quadratic Bezier through mid
    const a = startWorld.clone().lerp(midPoint, e);
    const b = midPoint.clone().lerp(wallTarget, e);
    rolled.position.copy(a.lerp(b, e));
    rolled.quaternion.copy(startQuat).slerp(endQuat, e);
    if (t >= 1) {
      // Swap rolled → flat
      scene.remove(rolled);
      p.flat.visible = true;
      p.flat.scale.set(0.02, 1, 1);
      p.state = 'unrolling';
      const t1 = now;
      p.anim = (nn) => {
        const tt = Math.min(1, (nn - t1) / 0.35);
        const ee = easeInOut(tt);
        p.flat.scale.set(0.02 + 0.98 * ee, 1, 1);
        if (tt >= 1) {
          p.flat.scale.set(1, 1, 1);
          p.state = 'hanging';
          hangingPoster = p;
          p.anim = null;
        }
      };
    }
  };
}

function rollPoster(p) {
  p.state = 'rolling';
  const flat = p.flat;
  const t0 = performance.now() / 1000;
  const dur1 = 0.3;
  p.anim = (now) => {
    const t = Math.min(1, (now - t0) / dur1);
    const e = easeInOut(t);
    flat.scale.set(1 - 0.98 * e, 1, 1);
    if (t >= 1) {
      flat.visible = false;
      flat.scale.set(1, 1, 1);
      // Fly rolled from wall back to basket slot
      const rolled = p.rolled;
      scene.add(rolled);
      const startWorld = new THREE.Vector3(-0.4, 3.0 - POSTER_H / 2 - 0.03, 0.08);
      const startQuat = new THREE.Quaternion();
      // target world of basket home
      const basketWorld = new THREE.Vector3();
      basketGroup.localToWorld(basketWorld.copy(p.home.pos));
      const endQuat = new THREE.Quaternion().setFromEuler(p.home.rot).premultiply(basketGroup.quaternion);
      const mid = new THREE.Vector3(
        (startWorld.x + basketWorld.x) / 2,
        Math.max(startWorld.y, basketWorld.y) + 0.5,
        (startWorld.z + basketWorld.z) / 2 + 0.3,
      );
      const t1 = now;
      const dur2 = 0.75;
      rolled.position.copy(startWorld);
      rolled.quaternion.copy(startQuat);
      p.anim = (nn) => {
        const tt = Math.min(1, (nn - t1) / dur2);
        const ee = easeInOut(tt);
        const a = startWorld.clone().lerp(mid, ee);
        const b = mid.clone().lerp(basketWorld, ee);
        rolled.position.copy(a.lerp(b, ee));
        rolled.quaternion.copy(startQuat).slerp(endQuat, ee);
        if (tt >= 1) {
          basketGroup.attach(rolled);
          rolled.position.copy(p.home.pos);
          rolled.rotation.copy(p.home.rot);
          p.state = 'rolled';
          if (hangingPoster === p) hangingPoster = null;
          p.anim = null;
        }
      };
    }
  };
}

// --- Hover highlight -----------------------------------------------------

let hovered = null;
function onPointerMove(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  const ref = hits.length ? hits[0].object.userData.posterRef : null;
  if (ref !== hovered) {
    if (hovered) setPosterHover(hovered, false);
    hovered = ref;
    if (hovered) setPosterHover(hovered, true);
    renderer.domElement.style.cursor = hovered ? 'pointer' : 'default';
  }
}
function setPosterHover(p, on) {
  const target = p.state === 'hanging' ? p.flat : p.rolled;
  target.traverse(o => {
    if (o.isMesh && o.material && o.material.emissive) {
      o.material.emissive.setHex(on ? 0x332200 : 0x000000);
    }
  });
}
renderer.domElement.addEventListener('pointermove', onPointerMove);

// --- Loop ----------------------------------------------------------------

function tick() {
  const now = performance.now() / 1000;
  posters.forEach(p => { if (p.anim) p.anim(now); });
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
