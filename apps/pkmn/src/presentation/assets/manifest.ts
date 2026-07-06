/**
 * The typed asset registry for the game.
 *
 * Every image, audio clip, and map the presentation can load is declared here so
 * the `AssetStore` can eagerly fetch them at boot and hand them out by id. The
 * registry ships empty: the renderer draws procedural placeholders for missing
 * assets, so the game is fully playable before any art or audio lands. Drop real
 * files under `src/presentation/assets/` and add their ids here to replace the
 * placeholders without touching rendering code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AssetManifest } from "../core/assets";

/** The complete set of assets loaded at boot (empty until real assets are added). */
export const MANIFEST: AssetManifest = {
	images: {},
	audio: {},
	maps: {},
};
