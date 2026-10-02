/**
 * Client runtime entry point. The board carries one island — the frame that fills a
 * position's dialog when it opens — so this file exists to resolve that island's module and
 * to fetch what its frame asks for, and to do nothing else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/component";

/**
 * The island modules a hydration record can name. It lists them one by one rather than
 * sweeping a directory, so a server-rendered component never becomes a client chunk by
 * sitting next to one that hydrates.
 */
const CLIENT_MODULES = import.meta.glob(["../resources/components/lazy-frame.tsx"]);

/** Boots the client runtime and resolves the island modules the server hydrated. */
let runtime = run({
	/** Resolves a hydrated island's module and named export from the URL the server wrote. */
	async loadModule(moduleUrl, exportName) {
		let pathname = new URL(moduleUrl, location.origin).pathname;

		let load = CLIENT_MODULES[`..${pathname}`];
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
	 * Fetches a frame's HTML, sending a URL-encoded body when the form declares that
	 * encoding so the server reads it under the requested type with file entries reduced to
	 * their name; the response's URL reflects any redirect for the frame to adopt.
	 *
	 * A response that is not content is refused rather than rendered: an error page written
	 * for a whole document has a head and a body of its own, and writing one into a region
	 * of a page that is otherwise fine puts a second document inside the first.
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
							typeof value === "string" ? value : value.name,
						]),
					)
				: formData;

		let response = await fetch(src, { credentials: "same-origin", headers, signal, method, body });

		let isHtml = response.headers.get("content-type")?.toLowerCase().includes("text/html");
		if (response.status >= 500 || (response.status >= 300 && !isHtml)) {
			throw new Error(`A frame answered ${response.status}`);
		}

		return response;
	},
});

/**
 * An island that throws on its way up leaves the server's own markup standing, which is the
 * same thing a visitor sees when there is no script to run at all. Saying so is what tells a
 * page that kept the plain link apart from one whose enhancement fell over.
 */
runtime.addEventListener("error", (event) => {
	console.error("A client entry failed to hydrate", event.error);
});
