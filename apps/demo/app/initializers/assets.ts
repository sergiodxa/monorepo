/**
 * The board's asset resolver, read from the manifest the Vite plugin writes: the source URLs
 * `vite dev` serves while editing, the hashed files `vite build` emits once built. The
 * document links what it returns, so no tag names a file the build may have renamed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

/**
 * Answers lookups by source path, relative to the app's root. The router resolves the
 * document's stylesheets and client entry through it once per request, and `render()`
 * resolves the board's island through it to the chunk the build emitted, with its preloads.
 */
export const assetResolver = createAssetResolver(manifest);
