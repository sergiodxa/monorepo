/**
 * Vite build configuration for the demo app. The Cloudflare plugin runs the worker in the
 * SSR environment and serves dev requests, while the Remix plugin builds the client entry
 * and writes the asset manifest the document resolves its hashed files through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cloudflare } from "@cloudflare/vite-plugin";
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite-plus";

export default defineConfig({
	test: {
		/**
		 * Mock call history survives from setup into the test. Vitest 5 clears it
		 * before each test, which would hide calls these suites assert on.
		 */
		clearMocks: false,
	},
	server: { port: 3008 },

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
