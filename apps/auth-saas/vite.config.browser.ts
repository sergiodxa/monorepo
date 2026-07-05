/**
 * Vite build for the platform dashboard's client-side JS bundle. Mirrors the `client`
 * build environment used by the sibling `r3-blog` app: it bundles `bootstrap/browser.ts`
 * (the `remix/ui` browser runtime) into `assets/clientEntry.js`, which the ASSETS
 * binding serves at `/assets/clientEntry.js` and the dashboard document shell loads via
 * a `<script type="module">`.
 *
 * This is intentionally separate from `vite.config.client.ts` (which builds the
 * `@pkg/oidc-provider` tenant entries into `assets/tenant/` as a library) because the
 * two outputs have different shapes: the tenant entries preserve named exports for
 * per-component hydration, whereas this bundle is a single self-executing entry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import fs from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";

import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/** Absolute path to the dashboard browser runtime entry. */
let clientEntry = path.resolve(import.meta.dirname, "bootstrap/browser.ts");

/** Output directory (the ASSETS-served `assets/`), relative to the project root. */
let outDir = "assets";

/**
 * Removes this build's own stale, content-hashed root-level chunks from `assets/` so
 * they do not accumulate across rebuilds. It deletes only top-level files in `assets/`
 * that are not part of the current bundle, and never recurses into subdirectories, so
 * the sibling tenant build's `assets/tenant/` output is left untouched. This is a
 * subdirectory-safe substitute for `build.emptyOutDir`, which would wipe `assets/tenant/`
 * and race the concurrent tenant watcher in `dev`.
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
				// Only prune top-level files; leave subdirectories (e.g. tenant/) alone.
				if (!entry.isFile()) continue;
				if (current.has(entry.name)) continue;
				fs.rmSync(path.join(outRoot, entry.name));
			}
		},
	};
}

export default defineConfig({
	plugins: [tsconfigPaths(), pruneStaleRootAssets()],
	build: {
		// Emit into the `assets/` directory the ASSETS binding serves (see wrangler.jsonc).
		// `emptyOutDir` stays off so this build never wipes the tenant build's
		// `assets/tenant/` output (a subdirectory of `assets/`); that also keeps `dev`'s
		// concurrent tenant/browser watchers from racing. Stale root-level chunks from
		// prior runs are instead pruned by `pruneStaleRootAssets()` above.
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
