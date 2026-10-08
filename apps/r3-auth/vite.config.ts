/**
 * Vite configuration for the authorization server. The Cloudflare plugin runs the worker in
 * the SSR environment, while the Remix plugin builds the client entry and writes the asset
 * manifest the document resolves its hashed files through. Sourcemaps are built for the client
 * only, since the asset plugin publishes every non-script file the server build emits beside
 * the client's, and a server sourcemap would expose the worker's source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cloudflare } from "@cloudflare/vite-plugin";
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite";

export default defineConfig({
	server: { port: 3002 },

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
