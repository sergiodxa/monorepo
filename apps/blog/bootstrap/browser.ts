/**
 * Client-side entrypoint for the blog browser bundle. Boots the Remix UI runtime, loading
 * each island from the chunk the renderer named for its `clientEntry(import.meta.url)`
 * identity, and fetches frames over the network as islands reload them. Pages stay
 * server-rendered documents: only the components marked with `clientEntry()` hydrate.
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
