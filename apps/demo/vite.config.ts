/**
 * Vite build configuration for the demo app. Registers the Cloudflare plugin so the worker
 * runs in the SSR environment, and declares the client bundle entry with stable asset
 * file-naming, keeping the entry ready for an island the talk might add live.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

const clientEntryPath = fileURLToPath(new URL("./bootstrap/browser.ts", import.meta.url));

export default defineConfig({
	server: { port: 3008 },

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
