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

/** The one stylesheet the document links, as a build combines the three it imports. */
export const STYLESHEET_HREF = "/assets/index.css";

/**
 * Every component module, each registered as its own browser entry the way a build emits one
 * for an island, so a rendered page names the chunk its islands hydrate from. The glob reads
 * only the paths, which keeps the manifest loadable inside workerd as well as under Node.
 */
const ISLAND_ENTRIES = Object.fromEntries(
	Object.keys(import.meta.glob(["/app/**/*.tsx", "/resources/**/*.tsx"])).map((path) => {
		let file = path.slice(1);
		return [file, `/assets/${file.replace(/\.tsx$/, ".js")}`];
	}),
);

const MANIFEST: BuildAssetsManifest = {
	mode: "build",
	entries: { "bootstrap/browser.ts": CLIENT_ENTRY_HREF, ...ISLAND_ENTRIES },
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
