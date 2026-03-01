import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	server: { port: 3004 },
	plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tailwindcss(), tsconfigPaths()],
});
