/**
 * Client-side entry for the platform dashboard. Boots the `remix/ui` runtime so the
 * server-rendered dashboard pages hydrate in the browser, loading any `clientEntry()`
 * component modules on demand and resolving `<Frame>` navigations. Mirrors the
 * `bootstrap/browser.ts` used by the sibling `r3-blog` app, with the module glob
 * pointing at this app's client-safe `app/views` and `routes` layers.
 *
 * The built asset is emitted to `assets/clientEntry.js` (see `vite.config.client.ts`)
 * and referenced from the dashboard document shell via a `<script type="module">`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/ui";

/**
 * Every client-loadable module in the app, keyed by its source path. `run()` resolves
 * a `clientEntry()` module URL to one of these lazy importers. Only client-safe layers
 * are globbed — the presentational `app/views` (where `clientEntry()` islands live, the
 * analog of `r3-blog`'s `resources`) and the `routes` map — never the server-only HTTP
 * controllers, which import Worker APIs (`cloudflare:workers`) that cannot resolve in
 * the browser. Server-only modules (`*.server.*`) are excluded defensively.
 */
let clientModules = import.meta.glob([
	"!../**/*.server.*",
	"../app/views/**/*.{ts,tsx}",
	"../routes/**/*.{ts,tsx}",
]);

run({
	/**
	 * Resolves a hydrated `clientEntry()` module URL to its named browser export.
	 *
	 * @param moduleUrl - The module URL encoded in the `clientEntry()` id.
	 * @param exportName - The export to pull from the resolved module.
	 * @returns The requested export (expected to be a component function).
	 */
	async loadModule(moduleUrl, exportName) {
		let pathname = new URL(moduleUrl, location.origin).pathname;

		let load = clientModules[`..${pathname}`];
		if (!load) throw new Error(`Unknown client entry module: ${moduleUrl}`);

		let mod = await load();

		if (!mod || typeof mod !== "object") {
			throw new Error(`Invalid client entry module: ${moduleUrl}`);
		}

		let entry = Reflect.get(mod, exportName);

		if (typeof entry !== "function") {
			throw new Error(`Missing client entry export ${exportName} in ${moduleUrl}`);
		}

		return entry;
	},

	/**
	 * Fetches the markup for a browser-loaded `<Frame>`, forwarding the frame target so
	 * the server can render just that frame.
	 *
	 * @param src - The `<Frame src>` value to load.
	 * @param signal - Abort signal for the active frame load or reload.
	 * @param target - Optional name of the frame being reloaded.
	 * @returns The frame's response body stream (or its text when no body is present).
	 */
	async resolveFrame(src, signal, target) {
		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		let response = await fetch(src, { credentials: "same-origin", headers, signal });
		return response.body ?? response.text();
	},
});
