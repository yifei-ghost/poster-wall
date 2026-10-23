import * as THREE from 'three';
import { makeRetroPrint, makePaperBack, makeTape } from './textures.js';

export const POSTER_W = 0.62;
export const POSTER_H = POSTER_W * (1224 / 792);

const SEG_X = 240;
const SEG_Y = 18;
const CORE_R = 0.022;
const PAPER_T = 0.0018;
const K = PAPER_T / (2 * Math.PI); // spiral growth per radian

function poster2DMaterial(front, back, grainTex) {
  const mat = new THREE.MeshStandardMaterial({
    map: front,
    bumpMap: grainTex,
    bumpScale: 0.6,
    roughness: 0.82,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.backMap = { value: back };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D backMap;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 sampledDiffuseColor = gl_FrontFacing
            ? texture2D( map, vMapUv )
            : texture2D( backMap, vec2( 1.0 - vMapUv.x, vMapUv.y ) );
          diffuseColor *= sampledDiffuseColor;
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'poster-two-sided';
  return mat;
}

export class Poster {
  constructor(index, image, grainTex) {
    this.index = index;
    this.state = 'basket';
    this.u = 0; // unrolled length, 0..W
    this.curl = 1; // paper memory curl on free edges when held
    this.wave = 0; // slight bulge once stuck to the wall
    this.wallZ = 0;

    const PX = 900;
    const PY = Math.round(PX * (1224 / 792));
    const front = new THREE.CanvasTexture(makeRetroPrint(image, index * 97 + 13, PX, PY));
    front.colorSpace = THREE.SRGBColorSpace;
    front.anisotropy = 16;
    const back = new THREE.CanvasTexture(makePaperBack(image, index * 97 + 13, PX / 2, PY / 2));
    back.colorSpace = THREE.SRGBColorSpace;

    this.geometry = new THREE.PlaneGeometry(POSTER_W, POSTER_H, SEG_X, SEG_Y);
    this.base = Float32Array.from(this.geometry.attributes.position.array);
    this.material = poster2DMaterial(front, back, grainTex);

    this.group = new THREE.Group(); // placement transform
    this.lift = new THREE.Group(); // hover offsets
    this.group.add(this.lift);

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.poster = this;
    this.lift.add(this.mesh);

    // Generous invisible pick target while rolled up
    this.proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, POSTER_H, 10),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.proxy.userData.poster = this;
    this.lift.add(this.proxy);

    const bandColors = [0xe0622c, 0x5b7393, 0xd9d2c3, 0x2c3340];
    this.band = new THREE.Mesh(
      new THREE.TorusGeometry(0.03, 0.0022, 8, 40),
      new THREE.MeshStandardMaterial({ color: bandColors[index % bandColors.length], roughness: 0.55, transparent: true }),
    );
    this.band.rotation.x = Math.PI / 2;
    this.band.castShadow = true;
    this.lift.add(this.band);

    this.tapes = [];
    const tapeGeo = new THREE.PlaneGeometry(0.11, 0.031);
    const corners = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
    corners.forEach(([sx, sy], i) => {
      const t = new THREE.Mesh(
        tapeGeo,
        new THREE.MeshStandardMaterial({
          map: makeTape(index * 10 + i),
          transparent: true,
          roughness: 0.65,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      );
      t.position.set(sx * (POSTER_W / 2 - 0.012), sy * (POSTER_H / 2 - 0.012), 0.0025);
      t.rotation.z = -sx * sy * (0.72 + ((i * 37) % 10) / 60);
      t.scale.setScalar(0);
      t.visible = false;
      t.receiveShadow = true;
      this.lift.add(t);
      this.tapes.push(t);
    });

    this.update();
  }

  // Rebuild vertex positions for the current roll / curl / wave state.
  update() {
    const pos = this.geometry.attributes.position.array;
    const base = this.base;
    const W = POSTER_W, H = POSTER_H;
    const u = THREE.MathUtils.clamp(this.u, 0, W);
    const L = W - u;
    const rOut = Math.sqrt(CORE_R * CORE_R + 2 * K * L);
    const curl = this.curl;
    const wave = this.wave;
    const shiftX = -u / 2;
    const edgeBand = W * 0.24;

    for (let i = 0; i < pos.length; i += 3) {
      const xp = base[i] + W / 2;
      const y = base[i + 1];
      let X, Z;
      if (xp <= u) {
        X = xp;
        Z = 0;
        if (curl > 0) {
          const l = Math.max(0, 1 - xp / edgeBand);
          const r = u >= W - 1e-4 ? Math.max(0, 1 - (W - xp) / edgeBand) : 0;
          Z += curl * 0.045 * (l * l * l + r * r * r);
        }
        if (wave > 0) {
          const yn = y / H + 0.5;
          Z += wave * 0.0035 * Math.sin(Math.PI * (xp / W)) * Math.sin(Math.PI * yn) * (0.6 + 0.4 * Math.sin(yn * 9.0 + xp * 7));
        }
      } else {
        const a = xp - u;
        const disc = Math.max(rOut * rOut - 2 * K * a, CORE_R * CORE_R);
        const th = (rOut - Math.sqrt(disc)) / K;
        const r = rOut - K * th;
        // Curls toward the viewer: print on the inside, paper back outside.
        X = u + r * Math.sin(th);
        Z = rOut - r * Math.cos(th);
      }
      pos[i] = X + shiftX;
      pos[i + 1] = y;
      pos[i + 2] = Z;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();

    // Keep the pick proxy and rubber band on the roll axis
    this.proxy.position.set(u + shiftX, 0, rOut);
    this.band.position.set(u + shiftX, POSTER_H * 0.22, rOut);
    const s = (rOut + 0.0015) / 0.03;
    this.band.scale.set(s, s, 1);
  }

  setTapes(visible) {
    this.tapes.forEach(t => { t.visible = visible; });
  }
}
