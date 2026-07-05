import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/** Absolute path to the browser entrypoint that boots the `remix/ui` runtime. */
let clientEntryPath = fileURLToPath(new URL("./bootstrap/browser.ts", import.meta.url));

export default defineConfig({
	server: { port: 3005 },

	// The `client` build environment mirrors `apps/r3-blog/vite.config.ts`: it
	// bundles `bootstrap/browser.ts` so server-rendered `remix/ui` pages hydrate.
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

	plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tsconfigPaths()],
});
