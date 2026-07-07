/**
 * The typed asset registry for the game.
 *
 * Every image, audio clip, map, and sprite atlas the presentation can load is
 * declared here so the `AssetStore` can eagerly fetch them at boot and hand them
 * out by id. The registry ships with no external art: the renderer draws
 * procedural placeholders (and a generated demo atlas) for missing assets, so the
 * game is fully playable before any real art or audio lands. Drop real files
 * under `src/assets/` and add their ids here to replace the placeholders
 * without touching rendering code.
 *
 * LEGAL: only original or openly-licensed art may be listed here. The ripped
 * commercial Pokémon FireRed/LeafGreen sprite sheets that happen to sit in this
 * folder (the `Game Boy Advance - Pokemon ...` files and the renamed
 * `battle-effects-*.png` from the same rip) must NEVER be referenced, renamed
 * into, or added to this manifest — they are off-limits copyrighted material.
 *
 * A sprite atlas is one image sliced into named sub-regions (see
 * `render/atlas.ts`). To add an openly-licensed pack (e.g. a CC-BY-SA tileset +
 * character sheet), place its image under `assets/`, then declare an `atlas`
 * entry: the image ref, a `regions` map of `name -> {x,y,w,h}`, and optional
 * `animations` of `name -> {frames,frameMs,loop}`. The `AssetStore` loads the
 * image and exposes the assembled `Atlas` by id; the renderers already blit by
 * region name, so no drawing code changes. Example (commented, no real file):
 *
 *   atlases: {
 *     overworld: {
 *       image: "/assets/openly-licensed-overworld.png", // CC-BY-SA pack, attributed in CREDITS
 *       regions: {
 *         "tile.grass": { x: 0, y: 0, w: 16, h: 16 },
 *         "hero.down.0": { x: 0, y: 16, w: 16, h: 16 },
 *       },
 *       animations: {
 *         "hero.down.walk": { frames: [ ... ], frameMs: 180, loop: true },
 *       },
 *     },
 *   }
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AssetManifest } from "~/presentation/core/assets";

/** The complete set of assets loaded at boot (no external art until one is added). */
export const MANIFEST: AssetManifest = {
	images: {},
	audio: {},
	maps: {},
	// No external atlases are shipped: the generated demo atlas
	// (`render/placeholder-atlas.ts`) supplies original art at runtime. An
	// openly-licensed pack would be declared here as documented above.
	atlases: {},
};
