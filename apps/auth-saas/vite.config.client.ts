import { globSync } from "node:fs";
import path from "node:path";

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
	plugins: [tailwindcss(), tsconfigPaths()],
	build: {
		emptyOutDir: true,
		lib: {
			// Build as library to preserve exports
			entry: clientInput,
			formats: ["es"],
		},
		rollupOptions: {
			output: {
				dir: "assets/tenant",
				entryFileNames: "[name].js",
				chunkFileNames: "[name]-[hash].js",
				assetFileNames: "[name]-[hash][extname]",
			},
			// Preserve exports from client entry modules
			preserveEntrySignatures: "exports-only",
		},
	},
});
