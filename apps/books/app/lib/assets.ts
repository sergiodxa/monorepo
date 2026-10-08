/**
 * The funnel's browser assets, read from the manifest the Vite plugin writes: the source URLs
 * `vite dev` serves while editing, the hashed files `vite build` emits once built. The
 * document links what this returns, so no tag names a file the build may have renamed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ScriptEntry } from "@pitlane/assets";

import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

/** Answers lookups by source path, relative to the app's root. */
const assets = createAssetResolver(manifest);

/** What the document shell links: the stylesheets every page wears and the client entry. */
export interface DocumentAssets {
	/** Stylesheet URLs, in the order the document imports them, which is the cascade order. */
	stylesheets: string[];
	/** The client entry's URL, the chunks it loads up front, and the import map they resolve by. */
	script: ScriptEntry;
}

/**
 * Looks up the document's assets. Called per render: the lookups read a manifest already in
 * memory, and a Worker may not start async work before its first request.
 *
 * @returns The stylesheets the document layout imports and the client entry's script.
 */
export async function documentAssets(): Promise<DocumentAssets> {
	let [stylesheets, script] = await Promise.all([
		assets.getStylesheets("resources/layouts/document.tsx"),
		assets.getScriptEntry("bootstrap/browser.ts"),
	]);

	return { stylesheets, script };
}
