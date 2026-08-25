/**
 * Client-side entry for the platform dashboard. Boots the `remix/ui` runtime so
 * server-rendered pages hydrate in the browser, loading `clientEntry()` component
 * modules on demand and resolving `<Frame>` navigations. The built asset is
 * emitted to `assets/clientEntry.js` and loaded via a `<script type="module">`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/ui";

/**
 * Every client-loadable module, keyed by its source path. Globs only the
 * client-safe `app/views` and `routes` layers, since HTTP controllers import
 * Worker APIs (`cloudflare:workers`) that cannot resolve in the browser.
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

		/**
		 * A form that declares the default encoding is sent as one, so the server
		 * reads the body under the encoding the form asked for.
		 */
		let body =
			formData && encType === "application/x-www-form-urlencoded"
				? new URLSearchParams(
						/**
						 * A file entry contributes its filename to a urlencoded
						 * submission — the only representation the server can act on.
						 */
						Array.from(formData, ([key, value]) => [
							key,
							value instanceof File ? value.name : value,
						]),
					)
				: formData;

		/**
		 * The response carries the URL it was redirected to, which the frame
		 * reads to update its own source after a submission.
		 */
		return await fetch(src, { credentials: "same-origin", headers, signal, method, body });
	},
});
