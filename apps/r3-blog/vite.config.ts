/**
 * Vite build configuration for the r3-blog app. Registers the Cloudflare plugin
 * to run the worker in the SSR environment, defines the client bundle entry
 * (bootstrap/browser.ts) with stable asset file-naming for deployment, and emits
 * sourcemaps. The client entry's name is pinned rather than hashed because the
 * document layouts reference `/assets/clientEntry.js` directly instead of going
 * through a manifest lookup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

const clientEntryPath = fileURLToPath(new URL("./bootstrap/browser.ts", import.meta.url));

export default defineConfig({
	// Sourcemaps are emitted for both environments. Note this publishes the app's
	// original source: the client maps are uploaded alongside the bundles and are
	// fetchable, so `/assets/clientEntry.js.map` is world-readable. That is the
	// accepted trade for readable production stack traces here; add `*.map` to
	// `.assetsignore` (or switch to Wrangler's `upload_source_maps`, which keeps
	// worker maps server-side) if that stops being acceptable.
	build: { sourcemap: true },

	server: { port: 3000 },

	resolve: { tsconfigPaths: true },

	environments: {
		client: {
			build: {
				rollupOptions: {
					input: {
						clientEntry: clientEntryPath,
					},
					output: {
						entryFileNames: "assets/[name].js",
						chunkFileNames: "assets/[name]-[hash].js",
					},
				},
			},
		},
	},

	plugins: [cloudflare({ viteEnvironment: { name: "ssr" } })],
});
