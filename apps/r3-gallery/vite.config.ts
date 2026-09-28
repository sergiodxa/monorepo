/**
 * Vite build configuration for the r3-gallery client-only demo. The Cloudflare plugin
 * serves the single-page gallery through the assets-only worker in dev and writes the
 * build where `cf deploy --prebuilt` uploads it; source maps keep production debuggable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
	build: { sourcemap: true },
	server: { port: 3000 },
	plugins: [cloudflare()],
});
