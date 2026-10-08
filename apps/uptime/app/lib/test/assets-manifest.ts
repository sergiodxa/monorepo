/**
 * The asset manifest tests read in place of the one the Vite plugin writes, which only a dev
 * server or a build produces. Shaped as a build's, so a rendered document links the same
 * kinds of tags production serves and a test can name the files it expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BuildAssetsManifest } from "@pitlane/assets";

/** Where the client entry is served from, which a test finds in the document's script tag. */
export const CLIENT_ENTRY_HREF = "/assets/browser.js";

/** The one stylesheet the document links, as a build combines the four it imports. */
export const STYLESHEET_HREF = "/assets/index.css";

/** A chunk the import map resolves, so a test can find it in the map the document writes. */
export const CHUNK_SPECIFIER = "/assets/chunk.js";

const manifest: BuildAssetsManifest = {
	mode: "build",
	entries: { "bootstrap/browser.ts": CLIENT_ENTRY_HREF },
	assets: {},
	importMap: { imports: { [CHUNK_SPECIFIER]: CHUNK_SPECIFIER } },
	serverEnvironment: "ssr",
	environments: {
		client: {
			role: "client",
			modules: { "bootstrap/browser.ts": { preloads: [CLIENT_ENTRY_HREF], stylesheets: [] } },
		},
		ssr: {
			role: "server",
			modules: {
				"resources/layouts/document.tsx": { preloads: [], stylesheets: [STYLESHEET_HREF] },
			},
		},
	},
};

export default manifest;
