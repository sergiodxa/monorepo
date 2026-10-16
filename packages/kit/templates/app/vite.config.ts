/**
 * Vite+ configuration: the dev server and build, the tests, and the formatting and lint rules
 * `vp check` applies. The Cloudflare plugin runs the Worker in the SSR environment, and the
 * Remix plugin builds the client entry and writes the asset manifest the document links from.
 */

import { cloudflare } from "@cloudflare/vite-plugin";
import { remix } from "@pitlane/vite-plugin-remix";
import { defineConfig } from "vite-plus";

export default defineConfig({
	resolve: { tsconfigPaths: true },

	plugins: [
		remix({
			clientEntry: "bootstrap/browser.ts",
			serverEntry: "bootstrap/worker.ts",
			serverHandler: false,
		}),
		/**
		 * Tests import modules on their own, in Node, so the Worker runtime the plugin starts
		 * is left out while Vitest runs.
		 */
		process.env.VITEST === undefined ? cloudflare({ viteEnvironment: { name: "ssr" } }) : null,
	],

	test: {
		include: ["app/**/*.test.ts?(x)", "resources/**/*.test.ts?(x)"],
		/** Vitest runs modules in Node, so the Worker runtime's module resolves to a stand-in. */
		alias: {
			"cloudflare:workers": new URL("app/test/cloudflare-workers.ts", import.meta.url).pathname,
		},
	},

	fmt: {
		useTabs: true,
		ignorePatterns: [".cloudflare/**"],
	},

	lint: {
		options: { typeAware: true, typeCheck: true },
		ignorePatterns: [".cloudflare/**"],
	},
});
