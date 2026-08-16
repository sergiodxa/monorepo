/**
 * Vite build configuration for the blog-saas worker: registers the Cloudflare plugin,
 * resolves tsconfig path aliases, and defines a `client` build environment that bundles
 * the browser hydration entry so server-rendered `remix/ui` pages hydrate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

/** Absolute path to the browser entrypoint that boots the `remix/ui` runtime. */
let clientEntryPath = fileURLToPath(new URL("./bootstrap/browser.ts", import.meta.url));

export default defineConfig({
	server: { port: 3005 },

	resolve: { tsconfigPaths: true },

	// The `client` build environment bundles `bootstrap/browser.ts` so
	// server-rendered `remix/ui` pages hydrate.
	// The `@cloudflare/vite-plugin` detects this environment, emits the bundle,
	// and wires the deployed worker to serve it (via the `ASSETS` binding).
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
