/**
 * Browser assets for the landing document: stylesheet URLs and the client entry
 * resolved from the Vite manifest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

/**
 * Answers lookups by source path relative to the app root. `assets()` and
 * `render()` resolve document stylesheets and islands through it.
 */
export const assetResolver = createAssetResolver(manifest);
