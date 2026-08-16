/**
 * Vite build for the tenant OIDC client bundles. Globs the `@pkg/oidc-provider` client
 * entries (e.g. WebAuthn flows) and builds them as an ES library into `assets/tenant/`,
 * preserving named exports so the tenant Durable Object can hydrate each component from
 * its `clientEntry()` URL. Kept separate from the dashboard browser bundle build.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { globSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "vite";

// The client entries live in @pkg/oidc-provider; build them into this app's
// assets/tenant/ (served by the DO at /assets/tenant/*.js, matching the
// clientEntry() URLs in the provider's components).
let providerDir = path.resolve(import.meta.dirname, "../../packages/oidc-provider");
let clientEntries = globSync("src/client/**/*.{ts,tsx}", { cwd: providerDir }).filter(
	(file) => !file.includes(".test."),
);

// Convert to input object: { "webauthn-auth": "<pkg>/src/client/webauthn-auth.tsx", ... }
let clientInput = Object.fromEntries(
	clientEntries.map((file) => {
		let name = path.basename(file, path.extname(file));
		return [name, path.resolve(providerDir, file)];
	}),
);

export default defineConfig({
	resolve: { tsconfigPaths: true },
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
