/**
 * Vite build configuration for the r3-blog app. Registers the Cloudflare plugin
 * to run the worker in the SSR environment and defines the client bundle entry
 * (bootstrap/browser.ts) with stable asset file-naming for deployment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

const clientEntryPath = fileURLToPath(new URL("./bootstrap/browser.ts", import.meta.url));

export default defineConfig({
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
