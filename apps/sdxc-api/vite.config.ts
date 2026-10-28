/**
 * Vite build for the apis Worker: Cloudflare runs the worker in the SSR environment;
 * the Remix plugin builds the client entry and the asset manifest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cloudflare } from "@cloudflare/vite-plugin";
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite-plus";

export default defineConfig({
	server: { port: 3010 },

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
