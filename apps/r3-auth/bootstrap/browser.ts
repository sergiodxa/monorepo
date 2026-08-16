/**
 * Browser entry point. Boots the client runtime and resolves the few modules that
 * hydrate — this app is server-rendered HTML, so this exists for the handful of
 * interactive components rather than for the pages themselves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/ui";

const clientModules = import.meta.glob([
	"!../**/*.server.*",
	"../resources/**/*.{ts,tsx}",
	"../routes/**/*.{ts,tsx}",
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
	async resolveFrame(src, options) {
		let { target, signal, method, formData, encType } = options ?? {};

		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		// A form that declares the default encoding is sent as one, so the server reads
		// the body under the type the form asked for rather than the multipart type
		// `fetch` picks for `FormData`.
		let body =
			formData && encType === "application/x-www-form-urlencoded"
				? new URLSearchParams(Array.from(formData, ([key, value]) => [key, String(value)]))
				: formData;

		// The response itself carries the URL it was redirected to, which the frame
		// reads to update its own source after a submission.
		return await fetch(src, { credentials: "same-origin", headers, signal, method, body });
	},
});
