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

/** The one stylesheet the document links, as a build combines the five it imports. */
export const STYLESHEET_HREF = "/assets/index.css";

/**
 * Every component module's source, keyed by its path from this file. Read through the
 * bundler rather than the file system, so the Workers pool, which has no view of the
 * host's files, sees the same set as the threads pool.
 */
const COMPONENT_SOURCES = import.meta.glob<string>(
	["../../{app,resources}/**/*.tsx", "!../../**/*.test.tsx"],
	{ query: "?raw", import: "default", eager: true },
);

/** An island export, however the formatter wraps the call's arguments. */
const ISLAND = /clientEntry\(\s*import\.meta\.url/;

/**
 * Every island module, each registered as its own browser entry the way a build emits one,
 * so a rendered page names the chunk its islands hydrate from.
 */
const ISLAND_ENTRIES = Object.fromEntries(
	Object.entries(COMPONENT_SOURCES)
		.filter(([, source]) => ISLAND.test(source))
		.map(([path]) => path.slice("../../".length))
		.map((file) => [file, `/assets/${file.replace(/\.tsx$/, ".js")}`]),
);

const manifest: BuildAssetsManifest = {
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

export default manifest;
