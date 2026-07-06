/**
 * Vite configuration for the uptime app. Wires up the Cloudflare Workers, React
 * Router, Tailwind CSS, and tsconfig-paths plugins, serves the dev server on port
 * 3002, and marks `node:async_hooks` as external for the Rollup build. It exists
 * to define how the app is bundled and run in both development and production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	server: { port: 3002 },
	plugins: [
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
	],
	build: {
		rollupOptions: {
			external: ["node:async_hooks"],
		},
	},
});
