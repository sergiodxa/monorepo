/**
 * The asset manifest tests read in place of the one the Vite plugin writes, which only a dev
 * server or a build produces. Shaped as a build's, so a rendered document links the same
 * kinds of tags production serves and a test can name the files it expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { BuildAssetsManifest } from "@pitlane/assets";

/** Where the client entry is served from, which a test finds in the document's script tag. */
export const CLIENT_ENTRY_HREF = "/assets/browser.js";

/** The one stylesheet the document links, as a build combines the four it imports. */
export const STYLESHEET_HREF = "/assets/index.css";

/** The app's root, which every manifest key is relative to. */
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/** An island export, however the formatter wraps the call's arguments. */
const ISLAND = /clientEntry\(\s*import\.meta\.url/;

/**
 * Every island module, each registered as its own browser entry the way a build emits one,
 * so a rendered page names the chunk its islands hydrate from.
 */
const ISLAND_ENTRIES = Object.fromEntries(
	globSync("{app,resources}/**/*.tsx", { cwd: APP_DIR })
		.filter((file) => ISLAND.test(readFileSync(join(APP_DIR, file), "utf8")))
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
