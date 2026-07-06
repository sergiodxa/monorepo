/**
 * Vite build configuration for the r3-gallery client-only demo. It enables source
 * maps and pins the dev server to port 3000 so the static single-page gallery can
 * be served and debugged consistently across the team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defineConfig } from "vite";

/**
 * Configures a static client-only Vite build for the Remix UI router gallery demo.
 */
export default defineConfig({
	build: { sourcemap: true },
	server: { port: 3000 },
});
