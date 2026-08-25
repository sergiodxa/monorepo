/**
 * Vite build for the platform dashboard's client-side JS bundle. Bundles
 * `bootstrap/browser.ts` into `assets/clientEntry.js`, which the ASSETS
 * binding serves and the dashboard document shell loads as a module script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import fs from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";

import { defineConfig } from "vite";

let clientEntry = path.resolve(import.meta.dirname, "bootstrap/browser.ts");

let outDir = "assets";

/**
 * Deletes only top-level files in `assets/` that fell out of the current
 * bundle, leaving subdirectories like `assets/tenant/` untouched so it can
 * stand in for `build.emptyOutDir` without wiping that concurrent build.
 *
 * @returns A Vite plugin that prunes orphaned top-level assets after each write.
 */
function pruneStaleRootAssets(): Plugin {
	return {
		name: "auth-saas:prune-stale-root-assets",
		writeBundle(_options, bundle) {
			let outRoot = path.resolve(import.meta.dirname, outDir);
			let current = new Set(Object.keys(bundle));

			let entries: fs.Dirent[];
			try {
				entries = fs.readdirSync(outRoot, { withFileTypes: true });
			} catch {
				return;
			}

			for (let entry of entries) {
				if (!entry.isFile()) continue;
				if (current.has(entry.name)) continue;
				fs.rmSync(path.join(outRoot, entry.name));
			}
		},
	};
}

export default defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [pruneStaleRootAssets()],
	build: {
		outDir,
		emptyOutDir: false,
		rollupOptions: {
			input: { clientEntry },
			output: {
				entryFileNames: "[name].js",
				chunkFileNames: "[name]-[hash].js",
				assetFileNames: "[name]-[hash][extname]",
			},
		},
	},
});
