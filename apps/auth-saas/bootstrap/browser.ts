/**
 * Client-side entry for the platform dashboard. Boots the `remix/ui` runtime so the
 * server-rendered dashboard pages hydrate in the browser, loading any `clientEntry()`
 * component modules on demand and resolving `<Frame>` navigations. The module glob
 * points at this app's client-safe `app/views` and `routes` layers.
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
 * are globbed — the presentational `app/views` (where `clientEntry()` islands live) and
 * the `routes` map — never the server-only HTTP
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
	 * the server can render just that frame, and the submission that triggered a
	 * reload so a form inside a frame reaches the server as the form it was.
	 *
	 * @param src - The `<Frame src>` value to load.
	 * @param options - Target, abort signal, and submission for the active frame load.
	 * @returns The frame's response, whose body is rendered into the frame.
	 */
	async resolveFrame(src, options) {
		let { target, signal, method, formData, encType } = options ?? {};

		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		// A form that declares the default encoding is sent as one, so the server reads
		// the body under the type the form asked for rather than the multipart type
		// `fetch` picks for `FormData`.
		let body =
			formData && encType === "application/x-www-form-urlencoded"
				? new URLSearchParams(
						// A file entry has no text form; a urlencoded submission carries its
						// filename, which is what the server can act on.
						Array.from(formData, ([key, value]) => [
							key,
							value instanceof File ? value.name : value,
						]),
					)
				: formData;

		// The response itself carries the URL it was redirected to, which the frame
		// reads to update its own source after a submission.
		return await fetch(src, { credentials: "same-origin", headers, signal, method, body });
	},
});
