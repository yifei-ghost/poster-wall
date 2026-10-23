import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { makePlaster, makeFloorboards, makePaperGrain, makeWindowCookie, makeLinearShadow } from './textures.js';
import { makeShelf, makeTurntable, makeGlassLamp, makeBasket } from './props.js';
import { Poster, POSTER_W, POSTER_H } from './poster.js';

const POSTER_COUNT = 8;
const HOVER_Z = 0.16;
const FOV = 34;
// Framing, measured on the wall plane: crop just above the shelf's lower tier, lots of wall above.
const VIEW_BOTTOM = 0.42;
const VIEW_TOP = 2.36;
const VIEW_X = 0.2;
const MIN_HALF_W = 1.45;
const PLACE_MARGIN = 0.05;

const loaderEl = document.getElementById('loader');
const hintEl = document.getElementById('hint');
// Yield so the loader can paint; the timeout keeps loading moving in background tabs where rAF is paused.
const nextFrame = () => new Promise(r => {
  requestAnimationFrame(() => r());
  setTimeout(r, 60);
});

// --- Tweening ------------------------------------------------------------

const ease = {
  linear: t => t,
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
  outQuint: t => 1 - Math.pow(1 - t, 5),
};
const tweens = new Set();
function animate(duration, update, fn = ease.inOutCubic) {
  return new Promise(resolve => {
    tweens.add({ start: performance.now(), duration: duration * 1000, update, fn, resolve });
  });
}
const sleep = s => new Promise(r => setTimeout(r, s * 1000));
function runTweens(now) {
  for (const tw of tweens) {
    const t = Math.min(1, (now - tw.start) / tw.duration);
    tw.update(tw.fn(t), t);
    if (t >= 1) {
      tweens.delete(tw);
      tw.resolve();
    }
  }
}

async function init() {
  // --- Renderer / scene --------------------------------------------------

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  document.getElementById('stage').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1d24);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;

  const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.05, 50);
  const view = { halfW: 2, halfH: 1, cx: VIEW_X, cy: 1.4, d: 3 };
  function frameCamera() {
    const aspect = window.innerWidth / window.innerHeight || 16 / 10;
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const baseHalfH = (VIEW_TOP - VIEW_BOTTOM) / 2;
    let halfH = baseHalfH;
    if (halfH * aspect < MIN_HALF_W) halfH = MIN_HALF_W / aspect;
    // Tall screens: most of the extra height goes to wall above, some below to keep the shelf in frame.
    const extra = halfH - baseHalfH;
    view.halfH = halfH;
    view.halfW = halfH * aspect;
    view.cx = VIEW_X;
    view.cy = VIEW_BOTTOM + halfH - extra * 0.75;
    view.bottom = view.cy - halfH;
    view.d = halfH / t;
    camera.aspect = aspect;
    camera.position.set(view.cx, view.cy, view.d);
    camera.lookAt(view.cx, view.cy, 0);
    camera.updateProjectionMatrix();
  }
  frameCamera();

  // --- Room ----------------------------------------------------------------

  await nextFrame();
  const plaster = makePlaster();
  plaster.map.repeat.set(4.5, 3);
  plaster.bump.repeat.set(4.5, 3);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 6),
    new THREE.MeshStandardMaterial({ map: plaster.map, bumpMap: plaster.bump, bumpScale: 1.2, roughness: 0.94, color: 0xf2f4f8 }),
  );
  wall.position.set(0, 3, 0);
  wall.receiveShadow = true;
  scene.add(wall);

  await nextFrame();
  const boards = makeFloorboards();
  for (const t of [boards.map, boards.bump, boards.rough]) t.repeat.set(4.5, 3.5);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 7),
    new THREE.MeshStandardMaterial({ map: boards.map, bumpMap: boards.bump, bumpScale: 2, roughnessMap: boards.rough, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 3.5);
  floor.receiveShadow = true;
  scene.add(floor);

  // Ambient occlusion where wall meets floor
  const aoTex = makeLinearShadow();
  const wallAO = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 0.22),
    new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  wallAO.position.set(0, 0.11, 0.001);
  wallAO.rotation.z = Math.PI; // dark edge at the bottom
  wallAO.material.map.flipY = true;
  scene.add(wallAO);
  const floorAO = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 0.3),
    new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  floorAO.rotation.x = -Math.PI / 2;
  floorAO.position.set(0, 0.001, 0.15);
  scene.add(floorAO);

  // --- Props -----------------------------------------------------------

  const shelf = makeShelf();
  shelf.group.position.set(-0.25, 0, 0.215);
  scene.add(shelf.group);

  const turntable = makeTurntable();
  turntable.group.position.set(-0.6, shelf.topY, 0.235);
  scene.add(turntable.group);

  const lamp = makeGlassLamp();
  lamp.group.position.set(-0.08, shelf.topY, 0.16);
  lamp.group.rotation.y = 0.12;
  scene.add(lamp.group);

  const basket = makeBasket();
  basket.group.position.set(1.08, 0, 0.36);
  scene.add(basket.group);

  // --- Lighting ----------------------------------------------------------

  scene.add(new THREE.HemisphereLight(0xaebfe6, 0x34343a, 0.42));

  // Cool window light falling across the wall from the left
  const windowLight = new THREE.SpotLight(0xd2deff, 70, 0, 0.42, 0.55, 2);
  windowLight.position.set(-3.4, 3.3, 3.2);
  windowLight.target.position.set(-0.3, 1.45, 0);
  windowLight.map = makeWindowCookie();
  windowLight.castShadow = true;
  windowLight.shadow.mapSize.set(2048, 2048);
  windowLight.shadow.camera.near = 1;
  windowLight.shadow.camera.far = 12;
  windowLight.shadow.bias = -0.0004;
  windowLight.shadow.normalBias = 0.02;
  scene.add(windowLight, windowLight.target);

  const fill = new THREE.DirectionalLight(0xdfe7ff, 0.35);
  fill.position.set(1.5, 2.2, 5);
  scene.add(fill);

  // Broad warm wash from the lamp, the orange bloom on the wall
  const wash = new THREE.PointLight(0xff5e1f, 0.75, 0, 2);
  wash.position.set(-0.08, shelf.topY + 0.18, 0.38);
  scene.add(wash);

  // --- Posters -----------------------------------------------------------

  loaderEl.querySelector('span').textContent = 'Printing posters…';
  await nextFrame();
  const grain = new THREE.CanvasTexture(makePaperGrain());
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(2, 3);

  const images = await Promise.all(
    Array.from({ length: POSTER_COUNT }, (_, i) => {
      const img = new Image();
      const loaded = new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
      });
      img.src = `./posters/${String(i + 1).padStart(2, '0')}.png`;
      return loaded;
    }),
  );

  const posters = [];
  const slotOrigin = (slot) => {
    const o = new THREE.Vector3(0, POSTER_H / 2 + 0.018, 0).applyQuaternion(slot.quat).add(slot.pos);
    return o;
  };
  for (let i = 0; i < POSTER_COUNT; i++) {
    const p = new Poster(i, images[i], grain);
    p.slot = basket.slots[i];
    p.group.position.copy(slotOrigin(p.slot));
    p.group.quaternion.copy(p.slot.quat);
    basket.group.add(p.group);
    posters.push(p);
    if (i % 2 === 1) await nextFrame();
  }

  // --- Post-processing ---------------------------------------------------

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.85, 2.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform vec2 uRes;
      varying vec2 vUv;
      float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main() {
        vec2 d = vUv - 0.5;
        vec2 off = d * 0.0016 * length(d) * 2.0;
        vec3 c = vec3(
          texture2D(tDiffuse, vUv + off).r,
          texture2D(tDiffuse, vUv).g,
          texture2D(tDiffuse, vUv - off).b
        );
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c *= mix(vec3(0.86, 0.94, 1.1), vec3(1.03, 1.0, 0.97), smoothstep(0.15, 0.9, l));
        c = c * 0.955 + vec3(0.018, 0.022, 0.03);
        vec2 dv = d; dv.x *= uRes.x / uRes.y;
        c *= mix(0.68, 1.0, smoothstep(1.05, 0.3, length(dv)));
        c += (hash(vUv * uRes + fract(uTime * 7.0) * vec2(91.7, 37.3)) - 0.5) * 0.045;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  composer.addPass(grade);

  // --- Interaction -------------------------------------------------------

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(0, 0.3);
  const target = new THREE.Vector3(0, 1.5, 0);
  const tmp = new THREE.Vector3();
  const segA = new THREE.Vector3();
  const segB = new THREE.Vector3();
  let held = null;
  let holdZ = HOVER_Z;
  let busy = false;
  let hovered = null;
  let stackOrder = 0;
  let touchHolding = false;
  const heldVel = new THREE.Vector2();
  const heldPrev = new THREE.Vector2();

  function setNDC(e) {
    ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  const toScreen = (v) => {
    tmp.copy(v).project(camera);
    return [(tmp.x + 1) / 2 * window.innerWidth, (1 - tmp.y) / 2 * window.innerHeight];
  };
  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = THREE.MathUtils.clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  // Rolls are picked by whichever roll axis is nearest the cursor on screen,
  // so thin, overlapping rolls are each easy to isolate.
  function pickRoll() {
    const px = (ndc.x + 1) / 2 * window.innerWidth;
    const py = (1 - ndc.y) / 2 * window.innerHeight;
    let best = null;
    let bestD = Math.max(16, window.innerHeight * 0.028);
    for (const p of posters) {
      if (p.state !== 'basket') continue;
      p.rollSegment(segA, segB);
      const [ax, ay] = toScreen(segA);
      const [bx, by] = toScreen(segB);
      const d = distToSegment(px, py, ax, ay, bx, by);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function pickPoster() {
    const roll = pickRoll();
    if (roll) return roll;
    raycaster.setFromCamera(ndc, camera);
    const onWall = posters.filter(p => p.state === 'wall').map(p => p.mesh);
    const hit = raycaster.intersectObjects(onWall, false)[0];
    return hit ? hit.object.userData.poster : null;
  }

  function pointedAtBasket() {
    if (pickRoll()) return true;
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(basket.group, true).length > 0;
  }

  // Furniture silhouettes projected onto the wall plane: posters may not overlap these.
  const obstacles = [];
  const box = new THREE.Box3();
  const meshBox = new THREE.Box3();
  const corner = new THREE.Vector3();
  function computeObstacles() {
    obstacles.length = 0;
    for (const obj of [shelf.group, turntable.group, lamp.group, basket.group]) {
      box.makeEmpty();
      obj.updateWorldMatrix(true, true);
      obj.traverse(o => {
        if (o.isMesh && !o.userData.noBounds) box.union(meshBox.setFromObject(o));
      });
      const r = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
        const s = view.d / (view.d - corner.z);
        const x = view.cx + (corner.x - view.cx) * s;
        const y = view.cy + (corner.y - view.cy) * s;
        r.minX = Math.min(r.minX, x); r.maxX = Math.max(r.maxX, x);
        r.minY = Math.min(r.minY, y); r.maxY = Math.max(r.maxY, y);
      }
      obstacles.push(r);
    }
  }

  function viewBounds() {
    const m = PLACE_MARGIN;
    return {
      minX: view.cx - view.halfW + POSTER_W / 2 + m,
      maxX: view.cx + view.halfW - POSTER_W / 2 - m,
      minY: Math.max(view.bottom, 0) + POSTER_H / 2 + m,
      maxY: view.cy + view.halfH - POSTER_H / 2 - m,
    };
  }

  function clampToView(v, b) {
    v.x = b.maxX > b.minX ? THREE.MathUtils.clamp(v.x, b.minX, b.maxX) : view.cx;
    v.y = b.maxY > b.minY ? THREE.MathUtils.clamp(v.y, b.minY, b.maxY) : b.minY;
  }

  function placeTarget(v) {
    const b = viewBounds();
    clampToView(v, b);
    const hw = POSTER_W / 2 + PLACE_MARGIN;
    const hh = POSTER_H / 2 + PLACE_MARGIN;
    for (let iter = 0; iter < 6; iter++) {
      let moved = false;
      for (const o of obstacles) {
        const ox = Math.min(v.x + hw, o.maxX) - Math.max(v.x - hw, o.minX);
        const oy = Math.min(v.y + hh, o.maxY) - Math.max(v.y - hh, o.minY);
        if (ox <= 0 || oy <= 0) continue;
        // Slide out the cheapest way: up, or sideways if that stays on screen.
        const opts = [{ dx: 0, dy: o.maxY - (v.y - hh) }];
        const left = (v.x + hw) - o.minX;
        const right = o.maxX - (v.x - hw);
        if (v.x - left >= b.minX) opts.push({ dx: -left, dy: 0 });
        if (v.x + right <= b.maxX) opts.push({ dx: right, dy: 0 });
        opts.sort((a, c) => Math.abs(a.dx) + a.dy - (Math.abs(c.dx) + c.dy));
        v.x += opts[0].dx;
        v.y += opts[0].dy;
        moved = true;
      }
      if (!moved) break;
    }
    v.y = Math.min(v.y, Math.max(b.maxY, b.minY));
  }

  function updateTarget() {
    raycaster.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -holdZ);
    if (raycaster.ray.intersectPlane(plane, tmp)) {
      // Map the hover-plane hit back onto the wall so the poster sits under the cursor.
      const s = view.d / (view.d - holdZ);
      target.set(view.cx + (tmp.x - view.cx) * s, view.cy + (tmp.y - view.cy) * s, 0);
      placeTarget(target);
    }
  }

  function slotWorld(p) {
    const pos = basket.group.localToWorld(slotOrigin(p.slot));
    const quat = basket.group.quaternion.clone().multiply(p.slot.quat);
    return { pos, quat };
  }

  function bezier(a, b, c, t, out) {
    const it = 1 - t;
    return out.set(0, 0, 0).addScaledVector(a, it * it).addScaledVector(b, 2 * it * t).addScaledVector(c, t * t);
  }

  async function flyTo(p, endPos, endQuat, dur, arc = 0.35) {
    const g = p.group;
    const a = g.position.clone();
    const q0 = g.quaternion.clone();
    const mid = a.clone().lerp(endPos, 0.5);
    mid.y = Math.max(a.y, endPos.y) + arc;
    mid.z += 0.25;
    await animate(dur, e => {
      bezier(a, mid, endPos, e, g.position);
      g.quaternion.slerpQuaternions(q0, endQuat, e);
    });
  }

  async function takeOut(p) {
    busy = true;
    p.state = 'lifting';
    setHint('Unrolling…');
    p.lift.position.set(0, 0, 0);
    scene.attach(p.group);
    const g = p.group;

    // Draw it straight up out of the basket along its own axis
    const start = g.position.clone();
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(g.quaternion);
    const up = start.clone().addScaledVector(axis, 0.62);
    await animate(0.5, e => g.position.lerpVectors(start, up, e), ease.outCubic);

    // Bring it up to the viewer, roll facing forward
    const pres = new THREE.Vector3(view.cx, view.cy - 0.02, camera.position.z - 1.95);
    await flyTo(p, pres, new THREE.Quaternion(), 0.75, 0.25);

    // Snap the band off, then unroll: the print is revealed as the roll travels across
    await animate(0.22, (e) => {
      p.band.position.y = POSTER_H * 0.22 + e * 0.12;
      p.band.scale.z = 1 - e;
      p.band.material.opacity = 1 - e;
    }, ease.inCubic);
    p.band.visible = false;
    p.state = 'unrolling';
    const ry = g.rotation.y;
    await animate(1.35, (e, t) => {
      p.u = POSTER_W * e;
      p.update();
      g.rotation.y = ry + Math.sin(t * Math.PI * 2) * 0.05 * (1 - t);
      g.rotation.z = Math.sin(t * Math.PI * 3) * 0.015 * (1 - t);
    }, ease.outCubic);
    p.u = POSTER_W;
    p.update();
    await sleep(0.25);

    // Carry it to the wall; it hovers there following the cursor
    held = p;
    p.state = 'held';
    heldPrev.set(g.position.x, g.position.y);
    const z0 = g.position.z;
    const r0 = g.rotation.clone();
    holdZ = z0;
    updateTarget();
    setHint('Move to place  ·  click to stick  ·  esc to put back');
    await animate(0.8, e => {
      holdZ = THREE.MathUtils.lerp(z0, HOVER_Z, e);
      g.rotation.y = r0.y * (1 - e);
    }, ease.inOutCubic);
    busy = false;
  }

  async function stick(p) {
    busy = true;
    held = null;
    p.state = 'sticking';
    const g = p.group;
    const z0 = g.position.z;
    stackOrder += 1;
    const z1 = 0.0035 + Math.min(stackOrder, 40) * 0.0011;
    const rz0 = g.rotation.z, rz1 = (Math.random() - 0.5) * 0.045;
    const rx0 = g.rotation.x;
    const c0 = p.curl;
    await animate(0.24, e => {
      g.position.z = THREE.MathUtils.lerp(z0, z1, e);
      g.rotation.z = THREE.MathUtils.lerp(rz0, rz1, e);
      g.rotation.x = THREE.MathUtils.lerp(rx0, 0, e);
      p.curl = c0 * (1 - e);
      p.update();
    }, ease.inCubic);
    p.curl = 0;
    p.wave = 1;
    p.update();
    await animate(0.28, e => {
      const s = 1 + Math.sin(e * Math.PI) * 0.016;
      p.lift.scale.set(s, s, 1);
    }, ease.linear);
    p.state = 'wall';
    busy = false;
    refreshUI();
  }

  async function returnToBasket(p) {
    const { pos, quat } = slotWorld(p);
    const above = pos.clone().add(new THREE.Vector3(0, 0.6, 0));
    await flyTo(p, above, quat, 0.75, 0.3);
    const from = p.group.position.clone();
    await animate(0.45, e => p.group.position.lerpVectors(from, pos, e), ease.outQuint);
    basket.group.attach(p.group);
    p.group.position.copy(slotOrigin(p.slot));
    p.group.quaternion.copy(p.slot.quat);
    p.state = 'basket';
  }

  async function rollUp(p, dur = 0.95) {
    const u0 = p.u;
    await animate(dur, e => {
      p.u = u0 * (1 - e);
      p.update();
    }, ease.inOutCubic);
    p.curl = 1;
    p.u = 0;
    p.update();
    p.band.visible = true;
    p.band.scale.z = 1;
    animate(0.25, e => { p.band.material.opacity = e; }, ease.linear);
  }

  async function peel(p) {
    busy = true;
    p.state = 'peeling';
    setHint('Peeling…');
    hovered = null;
    const g = p.group;
    const z0 = g.position.z;
    const rz0 = g.rotation.z;
    await animate(0.4, (e, t) => {
      g.position.z = THREE.MathUtils.lerp(z0, 0.22, e);
      g.rotation.z = rz0 * (1 - e);
      g.rotation.x = Math.sin(t * Math.PI) * -0.18;
      p.wave = 1 - e;
      p.curl = e;
      p.update();
    }, ease.outCubic);
    p.lift.position.set(0, 0, 0);
    await rollUp(p);
    await returnToBasket(p);
    busy = false;
    refreshUI();
  }

  async function putBack(p) {
    busy = true;
    held = null;
    p.state = 'returning';
    const g = p.group;
    const r0 = g.quaternion.clone();
    animate(0.4, e => g.quaternion.slerpQuaternions(r0, new THREE.Quaternion(), e));
    await rollUp(p, 0.8);
    await returnToBasket(p);
    busy = false;
    refreshUI();
  }

  function setHint(text) {
    if (hintEl.textContent !== text) {
      hintEl.classList.remove('show');
      void hintEl.offsetWidth;
      hintEl.textContent = text;
      hintEl.classList.add('show');
    }
  }

  function refreshUI() {
    const n = posters.filter(p => p.state === 'wall').length;
    if (held) return;
    setHint(n === 0 ? 'Pick a rolled poster from the basket' : 'Pick another  ·  click a poster on the wall to peel it off');
  }

  const canvasEl = renderer.domElement;
  canvasEl.addEventListener('pointermove', e => {
    setNDC(e);
    if (held) {
      updateTarget();
      return;
    }
    const p = busy ? null : pickPoster();
    hovered = p;
    canvasEl.style.cursor = p ? 'pointer' : 'default';
  });

  canvasEl.addEventListener('pointerdown', e => {
    setNDC(e);
    if (held) {
      if (busy) return;
      if (pointedAtBasket()) {
        putBack(held);
        return;
      }
      updateTarget();
      if (e.pointerType === 'touch') {
        touchHolding = true;
        return;
      }
      stick(held);
      return;
    }
    if (busy) return;
    const p = pickPoster();
    if (!p) return;
    canvasEl.style.cursor = 'default';
    hovered = null;
    if (p.state === 'basket') takeOut(p);
    else if (p.state === 'wall') peel(p);
  });

  canvasEl.addEventListener('pointerup', e => {
    if (touchHolding && held && !busy) {
      setNDC(e);
      updateTarget();
      stick(held);
    }
    touchHolding = false;
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && held && !busy) putBack(held);
  });

  const size = new THREE.Vector2();
  function syncSize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.getSize(size);
    if (!w || !h || (size.x === w && size.y === h)) return;
    frameCamera();
    computeObstacles();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    grade.uniforms.uRes.value.set(w, h);
  }

  // --- Loop --------------------------------------------------------------

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    syncSize();
    runTweens(now);

    turntable.vinyl.rotation.y -= dt * 3.49; // 33⅓ rpm
    const flicker = 1 + Math.sin(t * 2.1) * 0.03 + Math.sin(t * 7.3) * 0.015;
    lamp.light.intensity = 0.75 * flicker;
    wash.intensity = 0.45 * flicker;
    lamp.hot.emissiveIntensity = 5 * flicker;

    if (held && held.state === 'held') {
      const g = held.group;
      const k = 1 - Math.exp(-dt * 9);
      g.position.x += (target.x - g.position.x) * k;
      g.position.y += (target.y - g.position.y) * k;
      g.position.z = holdZ;
      if (dt > 0) {
        heldVel.set((g.position.x - heldPrev.x) / dt, (g.position.y - heldPrev.y) / dt);
      }
      heldPrev.set(g.position.x, g.position.y);
      const sway = 1 - Math.exp(-dt * 7);
      const rzT = THREE.MathUtils.clamp(-heldVel.x * 0.07, -0.14, 0.14);
      const rxT = THREE.MathUtils.clamp(heldVel.y * 0.05, -0.1, 0.1);
      g.rotation.z += (rzT - g.rotation.z) * sway;
      g.rotation.x += (rxT - g.rotation.x) * sway;
      held.lift.position.y = Math.sin(t * 1.7) * 0.004;
    }

    const hk = 1 - Math.exp(-dt * 12);
    for (const p of posters) {
      const isHover = p === hovered && !busy && !held;
      if (p.state === 'basket') {
        const ty = isHover ? 0.1 : 0;
        p.lift.position.y += (ty - p.lift.position.y) * hk;
      } else if (p.state === 'wall') {
        const tz = isHover ? 0.012 : 0;
        p.lift.position.z += (tz - p.lift.position.z) * hk;
      }
      p.glow += ((isHover ? 1 : 0) - p.glow) * hk;
      p.material.emissiveIntensity = p.glow * 0.32;
    }

    grade.uniforms.uTime.value = t;
    composer.render();
    requestAnimationFrame(tick);
  }

  computeObstacles();
  refreshUI();
  requestAnimationFrame(tick);
  loaderEl.classList.add('done');
}

init();
