/**
 * Cloudflare configuration for the gallery, read by `cf` and the Vite plugin alike. The
 * worker has no entrypoint: it serves the Vite build as static assets, and every path
 * without a file answers with `index.html` so the client router resolves it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "r3-gallery",
		compatibilityDate: "2026-09-02",
		workersDev: true,
		observability: { enabled: true },
		assets: { notFoundHandling: "single-page-application" },
	},
});
