/**
 * Vite configuration for the reader app. Registers the Cloudflare plugin so the worker
 * builds and serves on Workers, declares the browser bundle's entry, and pins its output
 * file names so the document layout can link `/assets/clientEntry.js` without reading a
 * build manifest at render time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

const CLIENT_ENTRY_PATH = fileURLToPath(new URL("./bootstrap/browser.ts", import.meta.url));

export default defineConfig({
	build: { sourcemap: true },

	server: { port: 3006 },

	resolve: { tsconfigPaths: true },

	environments: {
		client: {
			build: {
				rollupOptions: {
					input: { clientEntry: CLIENT_ENTRY_PATH },
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
