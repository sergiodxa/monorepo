/**
 * Vite build configuration for the auth-saas worker. The Cloudflare plugin runs the worker
 * in the SSR environment, while the Remix plugin builds the browser hydration entry and
 * writes the asset manifest the hosted document resolves its hashed files through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cloudflare } from "@cloudflare/vite-plugin";
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite";

export default defineConfig({
	server: { port: 3004 },

	resolve: { tsconfigPaths: true },

	plugins: [
		remix({
			clientEntry: "bootstrap/browser.ts",
			serverEntry: "bootstrap/worker.ts",
			serverHandler: false,
		}),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
	],
});
