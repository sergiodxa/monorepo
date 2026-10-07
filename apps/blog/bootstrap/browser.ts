/**
 * Client-side entrypoint for the blog browser bundle. Boots the Remix UI runtime,
 * lazily resolving client modules from resources and routes via a glob map, and fetches
 * frames over the network as islands reload them. Pages stay server-rendered documents:
 * only the components marked with `clientEntry()` hydrate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/component";

/**
 * Keeps every link and form a full document navigation: the runtime soft-navigates them
 * otherwise, and swapping a page in place makes Safari repaint it unstyled. Registered
 * before `run()`, so the runtime's own `navigate` listener never sees an event, while
 * explicit frame reloads, which bypass the Navigation API, keep working.
 */
function keepDocumentNavigations() {
	if (!("navigation" in window)) return;
	window.navigation.addEventListener("navigate", (event) => event.stopImmediatePropagation());
}

keepDocumentNavigations();

/**
 * Modules the runtime may hydrate. Tests sit next to the views they cover and reach for
 * the server application, so they stay out of the bundle the browser downloads.
 */
const clientModules = import.meta.glob([
	"!../**/*.server.*",
	"!../**/*.test.*",
	"../resources/**/*.{ts,tsx}",
	"../routes/**/*.{ts,tsx}",
]);

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
