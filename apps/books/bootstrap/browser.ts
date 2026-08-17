/**
 * Client runtime entry point. Nothing on the site loads it today — every page is
 * server-rendered HTML with native form validation — but it stays wired into the
 * Vite build so an island can be introduced later by linking it from the document
 * layout, without reshaping the build first.
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
