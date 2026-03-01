import { globSync } from "node:fs";
import path from "node:path";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Find all client entry files for browser build
let clientEntries = globSync("src/tenant/client/**/*.{ts,tsx}", { cwd: import.meta.dirname });

// Convert to input object: { "entry": "src/tenant/client/entry.ts", ... }
let clientInput = Object.fromEntries(
	clientEntries.map((file) => {
		let name = path.basename(file, path.extname(file));
		return [name, path.resolve(import.meta.dirname, file)];
	}),
);

export default defineConfig({
	server: { port: 3004 },
	plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tailwindcss(), tsconfigPaths()],
	build: {
		rollupOptions: {
			input: clientInput,
			output: {
				dir: "assets/tenant",
				entryFileNames: "[name].js",
				chunkFileNames: "[name]-[hash].js",
				assetFileNames: "[name]-[hash][extname]",
			},
		},
	},
});
