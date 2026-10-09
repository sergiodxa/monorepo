/**
 * Browser entry point. Pages are server-rendered HTML; the runtime hydrates their islands,
 * each loaded from the chunk the renderer named for its `clientEntry(import.meta.url)`
 * identity, so adding an island is only a matter of writing it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/component";

run({
	async loadModule(moduleUrl, exportName) {
		let mod: unknown = await import(/* @vite-ignore */ moduleUrl);

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
	 * Sends a urlencoded submission as `URLSearchParams`, with file values given
	 * as their name — the one thing this encoding carries for a file — and
	 * returns the raw response so the frame can read a redirect's URL from it.
	 */
	async resolveFrame(src, options) {
		let { target, signal, method, formData, encType } = options ?? {};

		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		let body =
			formData && encType === "application/x-www-form-urlencoded"
				? new URLSearchParams(
						Array.from(formData, ([key, value]): [string, string] => [
							key,
							value instanceof File ? value.name : value,
						]),
					)
				: formData;

		return await fetch(src, { credentials: "same-origin", headers, signal, method, body });
	},
});
