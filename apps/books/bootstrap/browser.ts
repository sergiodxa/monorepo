/**
 * Client runtime entry point. Every page is server-rendered HTML with native
 * form validation, and this file stays wired into the Vite build so a page
 * carrying an island needs only to pass `hydrates` to the document layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/component";

/**
 * Modules the runtime may hydrate: the islands, which belong in `resources/components/`.
 * Layouts and views stay out, since bundling them would ship their stylesheets twice, once
 * with the server's document and once in a chunk no page asks for. Tests reach for the
 * server application, so they stay out too.
 */
const clientModules = import.meta.glob([
	"!../**/*.server.*",
	"!../**/*.test.*",
	"../resources/components/**/*.{ts,tsx}",
]);

/**
 * Boots the client runtime and resolves lazily loaded UI modules.
 */
run({
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
	 * Sends a submission under the form's declared encoding, coercing a file
	 * entry to its filename for a urlencoded body, and returns the response
	 * as-is so the frame can read its redirect target.
	 */
	async resolveFrame(src, options) {
		let { target, signal, method, formData, encType } = options ?? {};

		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		let body =
			formData && encType === "application/x-www-form-urlencoded"
				? new URLSearchParams(
						Array.from(formData, ([key, value]) => [
							key,
							value instanceof File ? value.name : value,
						]),
					)
				: formData;

		return await fetch(src, { credentials: "same-origin", headers, signal, method, body });
	},
});
