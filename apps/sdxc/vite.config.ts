/**
 * Vite build configuration for the sdxc app. The Cloudflare plugin runs the worker in the
 * SSR environment and serves dev requests, the Remix plugin builds the client entry and
 * writes the asset manifest the document resolves its hashed files through, and the build is
 * stamped with an identifier the cache validator is built from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cloudflare } from "@cloudflare/vite-plugin";
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite";

/**
 * Names this build, so a cache validator can stand for "the bundle a page was rendered
 * from" rather than the bytes it happened to produce. Every page's inputs ship inside
 * the bundle, so one build is one version of every page.
 */
const BUILD_ID = Date.now().toString(36);

export default defineConfig(({ command }) => ({
	/**
	 * Only a build is stamped. The dev server reloads code under one long-lived process, so it
	 * stamps `null`, and every page it serves is rendered from the code as it stands now.
	 */
	define: { __BUILD_ID__: command === "build" ? JSON.stringify(BUILD_ID) : "null" },

	server: { port: 3007 },

	resolve: { tsconfigPaths: true },

	plugins: [
		remix({
			clientEntry: "bootstrap/browser.ts",
			serverEntry: "bootstrap/worker.ts",
			serverHandler: false,
		}),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
	],
}));
