# Assets

`manifest.json` is the typed asset registry (shape: `AssetManifest` in
`src/presentation/core/assets.ts`). The game loads it at boot and hands assets
out by id; missing assets fall back to procedural placeholders (and a generated
demo atlas in `render/placeholder-atlas.ts`), so the game is fully playable
before any real art or audio lands. It is authored data (JSON), so the dev tools
can write it directly — drop real files under `src/assets/` and add their ids to
`manifest.json` to replace placeholders without touching rendering code.

## Legal

Only **original or openly-licensed** art may be listed in `manifest.json`. Any
ripped commercial Pokémon FireRed/LeafGreen sprite sheets that happen to sit in
this folder are **off-limits copyrighted material** and must never be referenced,
renamed into, or added to the manifest.

## Sprite atlases

A sprite atlas is one image sliced into named sub-regions (see `render/atlas.ts`).
To add an openly-licensed pack (e.g. a CC-BY-SA tileset + character sheet), place
its image under `src/assets/`, then add an `atlases` entry: the image URL, a
`regions` map of `name -> {x,y,w,h}`, and optional `animations` of
`name -> {frames,frameMs,loop}`. The `AssetStore` loads the image and exposes the
assembled `Atlas` by id; the renderers already blit by region name, so no drawing
code changes. Example:

```json
{
  "atlases": {
    "overworld": {
      "image": "/assets/openly-licensed-overworld.png",
      "regions": {
        "tile.grass": { "x": 0, "y": 0, "w": 16, "h": 16 },
        "hero.down.0": { "x": 0, "y": 16, "w": 16, "h": 16 }
      },
      "animations": {
        "hero.down.walk": { "frames": [], "frameMs": 180, "loop": true }
      }
    }
  }
}
```
