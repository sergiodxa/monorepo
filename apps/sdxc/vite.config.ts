/**
 * Vite build configuration for the sdxc app. Registers the Cloudflare plugin so the
 * worker runs in the SSR environment, declares a client bundle entry with stable asset
 * file-naming so the document layout links `/assets/clientEntry.js` directly rather
 * than resolving it through a manifest, and stamps the build with an identifier the
 * cache validator is built from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

const clientEntryPath = fileURLToPath(new URL("./bootstrap/browser.ts", import.meta.url));

/**
 * Names this build, so a cache validator can stand for "the bundle a page was rendered
 * from" rather than the bytes it happened to produce. Every page's inputs ship inside
 * the bundle, so one build is one version of every page.
 */
const buildId = Date.now().toString(36);

export default defineConfig({
	define: { __BUILD_ID__: JSON.stringify(buildId) },

	server: { port: 3007 },

	resolve: { tsconfigPaths: true },

	environments: {
		client: {
			build: {
				rollupOptions: {
					input: { clientEntry: clientEntryPath },
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
