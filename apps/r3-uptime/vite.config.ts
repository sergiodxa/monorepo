import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	server: { port: 3000 },
	plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tsconfigPaths()],
});
