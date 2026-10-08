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

/** The one stylesheet the hosted document links, as a build combines the three it imports. */
export const STYLESHEET_HREF = "/assets/document.css";

/** The island chunk the import map resolves, so the rendered map carries an entry. */
const ISLAND_HREF = "/assets/passkey-button.js";

const MANIFEST: BuildAssetsManifest = {
	mode: "build",
	entries: { "bootstrap/browser.ts": CLIENT_ENTRY_HREF },
	assets: {},
	importMap: { imports: { "/app/views/hosted/passkey-button.tsx": ISLAND_HREF } },
	serverEnvironment: "ssr",
	environments: {
		client: {
			role: "client",
			modules: { "bootstrap/browser.ts": { preloads: [CLIENT_ENTRY_HREF], stylesheets: [] } },
		},
		ssr: {
			role: "server",
			modules: {
				"app/views/hosted/document.tsx": { preloads: [], stylesheets: [STYLESHEET_HREF] },
			},
		},
	},
};

export default MANIFEST;
