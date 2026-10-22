import * as THREE from 'three';

// --- Scene ---------------------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3eee6);

// Camera: locked straight-on, slightly above floor, no orbit controls.
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.2, 12.0);
camera.lookAt(0, 1.3, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

// --- Dimensions ---------------------------------------------------------

const WALL_W = 16;
const WALL_H = 9;
const WALL_Y = 1.6;

const ALC_W = 2.6;
const ALC_H_STRAIGHT = 3.0;
const ALC_FLOOR_Y = -2.5;
const ALC_CENTER_X = 0.0;

// --- Lighting ------------------------------------------------------------

scene.add(new THREE.AmbientLight(0xfff6ea, 0.55));

const key = new THREE.DirectionalLight(0xffffff, 0.5);
key.position.set(3, 6, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 7;
key.shadow.camera.bottom = -4;
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 20;
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.02;
scene.add(key);

const alcoveLight = new THREE.PointLight(0xff6a2a, 14.0, 12, 1.8);
alcoveLight.position.set(ALC_CENTER_X, 2.4, -1.2);
scene.add(alcoveLight);

const alcoveFill = new THREE.PointLight(0xffb382, 3.5, 6, 2.0);
alcoveFill.position.set(ALC_CENTER_X, 0.0, -0.9);
scene.add(alcoveFill);

// --- Wall with arched alcove --------------------------------------------

function buildWallWithAlcove() {
  const halfW = WALL_W / 2;
  const halfH = WALL_H / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfH);
  shape.lineTo(halfW, -halfH);
  shape.lineTo(halfW, halfH);
  shape.lineTo(-halfW, halfH);
  shape.lineTo(-halfW, -halfH);

  // Alcove hole — rounded top arch
  const localFloorY = ALC_FLOOR_Y - WALL_Y;             // relative to wall center
  const localArchStartY = localFloorY + ALC_H_STRAIGHT;
  const archCenterX = ALC_CENTER_X;
  const archRadius = ALC_W / 2;

  const hole = new THREE.Path();
  hole.moveTo(archCenterX - archRadius, localFloorY);
  hole.lineTo(archCenterX - archRadius, localArchStartY);
  hole.absarc(archCenterX, localArchStartY, archRadius, Math.PI, 0, true);
  hole.lineTo(archCenterX + archRadius, localFloorY);
  hole.lineTo(archCenterX - archRadius, localFloorY);
  shape.holes.push(hole);

  // Extrude slightly so the alcove has visible depth
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.6,
    bevelEnabled: false,
    curveSegments: 48,
  });
  // The extrude goes +z; we want wall to be at z≈0 with the inside depth going into -z.
  geo.translate(0, WALL_Y, -0.6);
  return geo;
}

const wallGeo = buildWallWithAlcove();
const wallMat = new THREE.MeshStandardMaterial({
  color: 0xf4ece0,
  roughness: 0.95,
  metalness: 0.0,
});
const wall = new THREE.Mesh(wallGeo, wallMat);
wall.castShadow = true;
wall.receiveShadow = true;
scene.add(wall);

// Back wall of the alcove — sits deeper in -z
const backWall = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 10),
  new THREE.MeshStandardMaterial({ color: 0xf1e4d2, roughness: 0.95 }),
);
backWall.position.set(0, WALL_Y, -1.6);
backWall.receiveShadow = true;
scene.add(backWall);

// Floor — pale wood plank
function makeFloorTexture() {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c8a97b';
  ctx.fillRect(0, 0, size, size);
  const plankH = 128;
  for (let y = 0; y < size; y += plankH) {
    const shade = Math.floor(Math.random() * 36) - 18;
    ctx.fillStyle = `rgb(${200 + shade},${169 + shade * 0.8},${123 + shade * 0.5})`;
    ctx.fillRect(0, y, size, plankH - 3);
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = `rgba(90,55,20,${0.04 + Math.random() * 0.07})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const yy = y + 4 + Math.random() * (plankH - 10);
      ctx.moveTo(0, yy);
      ctx.bezierCurveTo(
        size * 0.3, yy + (Math.random() - 0.5) * 5,
        size * 0.6, yy + (Math.random() - 0.5) * 5,
        size, yy + (Math.random() - 0.5) * 5,
      );
      ctx.stroke();
    }
    ctx.fillStyle = '#8d6a3e';
    ctx.fillRect(0, y + plankH - 3, size, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 14),
  new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.65 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -2.5, 5);
floor.receiveShadow = true;
scene.add(floor);

// Alcove floor patch (so the floor continues inside the alcove depth)
const alcoveFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(ALC_W + 1, 3),
  new THREE.MeshStandardMaterial({ color: 0xb8966a, roughness: 0.7 }),
);
alcoveFloor.rotation.x = -Math.PI / 2;
alcoveFloor.position.set(ALC_CENTER_X, -2.5, -0.8);
scene.add(alcoveFloor);

// Soft glow billboard inside alcove (reads as a hidden lamp)
function makeGlowTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,170,100,0.95)');
  g.addColorStop(0.4, 'rgba(255,110,50,0.4)');
  g.addColorStop(1, 'rgba(255,80,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlowTexture(),
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
}));
glowSprite.scale.set(4, 4, 1);
glowSprite.position.set(ALC_CENTER_X, 2.0, -1.0);
scene.add(glowSprite);

// --- Nail ---------------------------------------------------------------

// Nail positioned so a 2.0 x 3.09 poster hangs clearly to the LEFT of the alcove.
const NAIL_X = -3.6;
const NAIL_Y = 3.3;
const nail = new THREE.Mesh(
  new THREE.CylinderGeometry(0.03, 0.03, 0.08, 16),
  new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.7, roughness: 0.4 }),
);
nail.rotation.x = Math.PI / 2;
nail.position.set(NAIL_X, NAIL_Y, 0.05);
nail.castShadow = true;
scene.add(nail);

// --- Posters (individual textures) ---------------------------------------

const POSTER_COUNT = 8;
const POSTER_W = 2.0;
const POSTER_H = POSTER_W * (1224 / 792); // ≈ 3.09

const texLoader = new THREE.TextureLoader();
const posterTextures = await Promise.all(
  Array.from({ length: POSTER_COUNT }, (_, i) => {
    return new Promise((resolve) => {
      const n = String(i + 1).padStart(2, '0');
      texLoader.load(`./posters/${n}.png`, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 16;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        resolve(t);
      });
    });
  }),
);

// A side texture for the rolled poster — just the poster itself wrapping the cylinder vertically
function makeRollSideMat(tex) {
  const sideTex = tex.clone();
  sideTex.wrapS = THREE.RepeatWrapping;
  sideTex.wrapT = THREE.ClampToEdgeWrapping;
  sideTex.repeat.set(1, 1);
  sideTex.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map: sideTex,
    roughness: 0.9,
    metalness: 0.0,
  });
}

// Paper roll end cap
function makeCapTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f3ead6';
  ctx.fillRect(0, 0, size, size);
  for (let r = size * 0.47; r > 2; r -= 2.5) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(140,110,70,${0.06 + Math.random() * 0.09})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const capTex = makeCapTexture();
const capMat = new THREE.MeshStandardMaterial({ map: capTex, roughness: 0.95 });

// --- Basket --------------------------------------------------------------

const basketGroup = new THREE.Group();
basketGroup.position.set(4.4, -2.05, 2.4);
scene.add(basketGroup);

function makeBasketTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // Chalky off-white base so the basket reads retro-futurist, not rustic
  ctx.fillStyle = '#d9cfbf';
  ctx.fillRect(0, 0, size, size);
  const step = 28;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const even = ((x / step + y / step) | 0) % 2 === 0;
      const grad = ctx.createLinearGradient(x, y, x + step, y + step);
      if (even) {
        grad.addColorStop(0, '#eadfca');
        grad.addColorStop(0.5, '#f1e7d3');
        grad.addColorStop(1, '#c8baa0');
      } else {
        grad.addColorStop(0, '#b7a98e');
        grad.addColorStop(0.5, '#ccbea0');
        grad.addColorStop(1, '#9b8d72');
      }
      ctx.fillStyle = grad;
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

const basketBody = new THREE.Mesh(
  new THREE.CylinderGeometry(1.15, 0.86, 1.5, 48, 1, true),
  new THREE.MeshStandardMaterial({ map: makeBasketTexture(), roughness: 0.85, side: THREE.DoubleSide }),
);
basketBody.position.y = 0;
basketBody.castShadow = true;
basketBody.receiveShadow = true;
basketGroup.add(basketBody);

const basketRim = new THREE.Mesh(
  new THREE.TorusGeometry(1.15, 0.055, 10, 48),
  new THREE.MeshStandardMaterial({ color: 0x8d7857, roughness: 0.6 }),
);
basketRim.rotation.x = Math.PI / 2;
basketRim.position.y = 0.75;
basketRim.castShadow = true;
basketGroup.add(basketRim);

const basketFloor = new THREE.Mesh(
  new THREE.CircleGeometry(0.86, 48),
  new THREE.MeshStandardMaterial({ color: 0x3d2a1a, roughness: 1.0 }),
);
basketFloor.rotation.x = -Math.PI / 2;
basketFloor.position.y = -0.65;
basketGroup.add(basketFloor);

const blob = new THREE.Mesh(
  new THREE.CircleGeometry(1.5, 32),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
);
blob.rotation.x = -Math.PI / 2;
blob.position.set(basketGroup.position.x, -2.49, basketGroup.position.z);
scene.add(blob);

// --- Rolled posters inside the basket -----------------------------------

const ROLL_RADIUS = 0.11;
const ROLL_HEIGHT = 2.0;

function makeRolledMesh(i) {
  const group = new THREE.Group();
  const sideMat = makeRollSideMat(posterTextures[i]);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(ROLL_RADIUS, ROLL_RADIUS, ROLL_HEIGHT, 32, 1),
    [sideMat, capMat, capMat],
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  group.userData.body = body;
  return group;
}

function makeFlatMesh(i) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    map: posterTextures[i],
    roughness: 0.75,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(POSTER_W, POSTER_H), mat);
  paper.castShadow = true;
  paper.receiveShadow = true;
  group.add(paper);
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(POSTER_W + 0.02, POSTER_H + 0.02),
    new THREE.MeshStandardMaterial({ color: 0xf0e9d8, roughness: 0.9 }),
  );
  back.position.z = -0.005;
  group.add(back);
  return group;
}

// Lay out rolled posters inside the basket (ring arrangement, slight tilts)
const basketLocal = [];
for (let i = 0; i < POSTER_COUNT; i++) {
  const t = i / POSTER_COUNT;
  const angle = t * Math.PI * 2;
  const r = 0.42 + ((i * 37) % 10) / 60;
  basketLocal.push({
    pos: new THREE.Vector3(Math.cos(angle) * r, 0.9, Math.sin(angle) * r * 0.7),
    tilt: new THREE.Euler(
      ((i * 13) % 7 - 3) * 0.05,
      0,
      ((i * 29) % 11 - 5) * 0.06,
    ),
  });
}

const posters = [];
for (let i = 0; i < POSTER_COUNT; i++) {
  const rolled = makeRolledMesh(i);
  rolled.position.copy(basketLocal[i].pos);
  rolled.rotation.copy(basketLocal[i].tilt);
  basketGroup.add(rolled);

  const flat = makeFlatMesh(i);
  flat.visible = false;
  flat.position.set(NAIL_X, NAIL_Y - POSTER_H / 2 - 0.03, 0.04);
  scene.add(flat);

  posters.push({
    index: i,
    rolled,
    flat,
    home: {
      pos: basketLocal[i].pos.clone(),
      rot: basketLocal[i].tilt.clone(),
    },
    state: 'rolled',
    anim: null,
  });
}

// --- Picking ------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const pickables = [];
posters.forEach(p => {
  p.rolled.traverse(obj => { if (obj.isMesh) { obj.userData.posterRef = p; pickables.push(obj); } });
  p.flat.traverse(obj => { if (obj.isMesh) { obj.userData.posterRef = p; pickables.push(obj); } });
});

let hangingPoster = null;

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function hangPoster(p) {
  if (hangingPoster && hangingPoster !== p) {
    rollPoster(hangingPoster);
  }
  p.state = 'animatingUp';
  const rolled = p.rolled;
  const startWorld = new THREE.Vector3();
  rolled.getWorldPosition(startWorld);
  const startQuat = new THREE.Quaternion();
  rolled.getWorldQuaternion(startQuat);
  scene.attach(rolled);
  rolled.position.copy(startWorld);
  rolled.quaternion.copy(startQuat);

  const wallTarget = new THREE.Vector3(NAIL_X, NAIL_Y - POSTER_H / 2 - 0.03, 0.08);
  const mid = new THREE.Vector3(
    (startWorld.x + wallTarget.x) / 2,
    Math.max(startWorld.y, wallTarget.y) + 1.0,
    (startWorld.z + wallTarget.z) / 2 + 0.6,
  );
  const endQuat = new THREE.Quaternion();
  const dur = 0.85;
  let t0 = null;
  p.anim = (now) => {
    if (t0 === null) t0 = now;
    const t = Math.min(1, (now - t0) / dur);
    const e = easeInOut(t);
    const a = startWorld.clone().lerp(mid, e);
    const b = mid.clone().lerp(wallTarget, e);
    rolled.position.copy(a.lerp(b, e));
    rolled.quaternion.copy(startQuat).slerp(endQuat, e);
    if (t >= 1) {
      scene.remove(rolled);
      p.flat.visible = true;
      p.flat.scale.set(0.02, 1, 1);
      p.state = 'unrolling';
      const t1 = now;
      p.anim = (nn) => {
        const tt = Math.min(1, (nn - t1) / 0.4);
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
  const dur1 = 0.33;
  p.anim = (now) => {
    const t = Math.min(1, (now - t0) / dur1);
    const e = easeInOut(t);
    flat.scale.set(1 - 0.98 * e, 1, 1);
    if (t >= 1) {
      flat.visible = false;
      flat.scale.set(1, 1, 1);
      const rolled = p.rolled;
      scene.add(rolled);
      const startWorld = new THREE.Vector3(NAIL_X, NAIL_Y - POSTER_H / 2 - 0.03, 0.08);
      const startQuat = new THREE.Quaternion();
      const basketWorld = new THREE.Vector3();
      basketGroup.localToWorld(basketWorld.copy(p.home.pos));
      const endQuat = new THREE.Quaternion().setFromEuler(p.home.rot).premultiply(basketGroup.quaternion);
      const mid = new THREE.Vector3(
        (startWorld.x + basketWorld.x) / 2,
        Math.max(startWorld.y, basketWorld.y) + 0.9,
        (startWorld.z + basketWorld.z) / 2 + 0.5,
      );
      const t1 = now;
      const dur2 = 0.8;
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

function onPointerDown(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  if (!hits.length) return;
  const first = hits[0].object.userData.posterRef;
  if (!first) return;
  if (first.state === 'rolled') hangPoster(first);
  else if (first.state === 'hanging') rollPoster(first);
}

// Start with one poster already on the wall so the opening frame reads clearly.
(function initialHang() {
  const p = posters[0];
  basketGroup.remove(p.rolled);
  p.flat.visible = true;
  p.flat.scale.set(1, 1, 1);
  p.state = 'hanging';
  hangingPoster = p;
})();
renderer.domElement.addEventListener('pointerdown', onPointerDown);

// Hover cursor
function onPointerMove(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  renderer.domElement.style.cursor = hits.length ? 'pointer' : 'default';
}
renderer.domElement.addEventListener('pointermove', onPointerMove);

// --- Loop ----------------------------------------------------------------

function tick() {
  const now = performance.now() / 1000;
  posters.forEach(p => { if (p.anim) p.anim(now); });
  // Subtle flicker on the alcove light so the glow feels alive
  alcoveLight.intensity = 17.5 + Math.sin(now * 1.3) * 0.6 + Math.sin(now * 3.7) * 0.3;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
