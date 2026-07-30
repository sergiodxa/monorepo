/**
 * Vite configuration for the uptime app. Wires up the Cloudflare plugin so the
 * project builds and serves on Workers, defines a dedicated client entry from
 * bootstrap/browser.ts, and pins asset output names. It exists to bundle both the
 * SSR worker and the browser client for local dev and deployment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

const clientEntryPath = fileURLToPath(new URL("./bootstrap/browser.ts", import.meta.url));

export default defineConfig({
	build: {
		sourcemap: true,
		rollupOptions: { output: { codeSplitting: { maxSize: 500000 } } },
	},

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
