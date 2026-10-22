# Poster Wall

A tiny Three.js scene: one wall of a room, a woven basket in the bottom-right corner holding rolled-up posters, and a hook where any of them can be hung. Click a rolled poster to pin it to the wall; click the hanging poster to roll it back into the basket.

Poster artwork is sourced from a Figma design strip (8 variants).

## Run

```bash
npm install
npm run dev
```

Then open the printed localhost URL.

## Build

```bash
npm run build
npm run preview
```

## Stack

- [three.js](https://threejs.org/) r169
- Vanilla JS + Vite
- OrbitControls for camera, Raycaster for picking
