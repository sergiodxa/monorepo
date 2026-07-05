/**
 * Primary Vite config for the platform worker (the `ssr` environment). Wires up the
 * Cloudflare Workers Vite plugin, Tailwind, and tsconfig path resolution, and sets the
 * local dev server port. The two sibling configs build the browser/tenant client bundles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	server: { port: 3004 },
	plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tailwindcss(), tsconfigPaths()],
});
