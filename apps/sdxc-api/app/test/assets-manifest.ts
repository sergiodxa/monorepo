/**
 * Asset manifest stub for Vitest: the Vite plugin only writes a real one under
 * `vite dev` / `vite build`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BuildAssetsManifest } from "@pitlane/assets";

/** Client entry href a hydrating page would link. */
export const CLIENT_ENTRY_HREF = "/assets/browser.js";

/** Combined stylesheet the document links in tests. */
export const STYLESHEET_HREF = "/assets/index.css";

const MANIFEST: BuildAssetsManifest = {
	mode: "build",
	entries: { "bootstrap/browser.ts": CLIENT_ENTRY_HREF },
	assets: {},
	importMap: { imports: {} },
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

export default MANIFEST;
