# Poster Wall

A small Three.js room: a blank cool-white wall, a modular steel shelf with a turntable and a glass-block lamp, and a seagrass basket of rolled-up posters. Pull a poster out, watch it unroll, then stick it anywhere on the open wall.

## Interaction

- **Basket**: rolls fan out print-side out so you can tell them apart; the roll nearest the cursor lifts and brightens. Click to take it out. The rubber band snaps off and the poster unrolls in front of you.
- **Placing**: the poster floats just off the wall and follows the cursor, sliding around the shelf, turntable, lamp and basket so it never overlaps them. Click to press it onto the wall. `Esc` (or clicking the basket) rolls it back up.
- **On the wall**: click a poster to peel it off. It rolls up and drops back into the basket.

The camera is fixed straight-on.

## Run

```bash
npm install
npm run dev
```

## How it's built

- `src/poster.js`: each poster is one 240×18 segment plane, deformed on the CPU into an Archimedean spiral. One parameter (unrolled length) drives everything from a tight roll to a flat sheet. The front shows the print and the back shows the paper stock, with print show-through.
- `src/textures.js`: all procedural textures: tileable value-noise plaster, worn pine floorboards (color/bump/roughness), twined seagrass weave, retro print treatment (paper multiply, plate misregistration, halftone screen, grain, ink drop-outs, edge wear), vinyl grooves, window light cookie.
- `src/props.js`: steel shelf with chrome tubes and ball connectors, turntable with smoked acrylic lid and spinning record, transmissive glass-block lamp with a shadow-casting point light, lathe-turned basket.
- `src/main.js`: lighting (cool window spotlight with a mullion cookie, hemisphere fill, warm lamp + wash), post-processing (bloom, split-tone grade, vignette, grain, mild lens fringing), and the take-out / stick / peel state machine.

Poster artwork: 8 frames exported from the Figma file into `public/posters/`.
