/**
 * The asset resolver, read from the manifest the Vite plugin writes: the source files
 * `vp dev` serves while editing, and the hashed files `vp build` emits. The document
 * links what it returns, so no tag names a file the build renamed.
 */

import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

/** Resolves the document's stylesheets, its client entry and every island by source path. */
export const assetResolver = createAssetResolver(manifest);
