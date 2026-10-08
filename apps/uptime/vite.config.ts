/**
 * Vite configuration for the uptime app. The Cloudflare plugin runs the worker in the SSR
 * environment, while the Remix plugin builds the client entry and writes the asset manifest
 * the document resolves its hashed files through. Sourcemaps ship with the client bundle, so
 * they are world-readable: the accepted trade for readable browser stack traces. The server
 * build emits none, since the asset plugin publishes every file it emits beside the client's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cloudflare } from "@cloudflare/vite-plugin";
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite";

export default defineConfig({
	server: { port: 3000 },

	resolve: { tsconfigPaths: true },

	environments: { client: { build: { sourcemap: true } } },

	plugins: [
		remix({
			clientEntry: "bootstrap/browser.ts",
			serverEntry: "bootstrap/worker.ts",
			serverHandler: false,
		}),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
	],
});
