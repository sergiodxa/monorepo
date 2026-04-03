import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Configures Vite for the r3-blog SSR server with Cloudflare and tsconfig path plugins.
 */
export default defineConfig({
	server: { port: 3000 },
	plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tsconfigPaths()],
});
