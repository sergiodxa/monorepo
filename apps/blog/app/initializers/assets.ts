/**
 * The blog's asset resolver, read from the manifest the Vite plugin writes: the source URLs
 * `vite dev` serves while editing, the hashed files `vite build` emits once built. Every tag
 * the document and islands render names what this returns, never a file the build may rename.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

/**
 * Answers lookups by source path, relative to the app's root. The router's `assets()`
 * middleware resolves the document's stylesheets and client entry through it, and the
 * renderer resolves each island's `clientEntry(import.meta.url, …)` identity to its chunk.
 */
export const assetResolver = createAssetResolver(manifest);
