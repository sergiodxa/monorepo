import { defineConfig } from "vite";

/**
 * Configures a static client-only Vite build for the Remix UI router gallery demo.
 */
export default defineConfig({
	build: { sourcemap: true },
	server: { port: 3000 },
});
