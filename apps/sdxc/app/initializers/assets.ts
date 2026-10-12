/**
 * The site's browser assets, read from the manifest the Vite plugin writes: the source URLs
 * `vite dev` serves while editing, the hashed files `vite build` emits once built. Every tag
 * the document writes comes from a lookup here, so no tag names a file the build may rename.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

/**
 * Answers lookups by source path, relative to the app's root. The router resolves the
 * document's stylesheets and client entry through it per request, and the renderer resolves
 * each island's `clientEntry(import.meta.url, …)` identity to the chunk built for it.
 */
export const assetResolver = createAssetResolver(manifest);
