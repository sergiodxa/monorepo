# Assets

This folder holds the game's binary asset files (images, audio). The asset
registry that indexes them is authored data and lives with the other content:
`src/content/manifest.json` (shape: `AssetManifest` in
`src/presentation/core/assets.ts`). The game loads it at boot and hands assets
out by id; missing assets fall back to procedural placeholders (and a generated
demo atlas in `render/placeholder-atlas.ts`), so the game is fully playable
before any real art or audio lands. It is authored data (JSON), so the dev tools
can write it directly — drop real files under `src/assets/` and add their ids to
`src/content/manifest.json` to replace placeholders without touching rendering code.

## Sprite atlases

A sprite atlas is one image sliced into named sub-regions (see `render/atlas.ts`).
To add a pack (tileset + character sheet), place
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
