/**
 * The asset resolver over the manifest the Vite plugin writes: the source URLs `vite dev`
 * serves while editing, the hashed files `vite build` emits once built. Every document and
 * island links what it answers, so no tag names a file a build renamed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

/**
 * Answers lookups by source path, relative to the app's root. `render()` resolves each
 * island's `clientEntry(import.meta.url, …)` identity through it to the chunk the build
 * emitted for that island, and `assets()` resolves the hosted document's links through it.
 */
export const assetResolver = createAssetResolver(manifest);
