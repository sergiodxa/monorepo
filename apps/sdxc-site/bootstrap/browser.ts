/**
 * Client runtime entry point. Pages are server-rendered HTML and the runtime hydrates their
 * islands, each loaded from the chunk the renderer named for its `clientEntry(import.meta.url)`
 * identity, so adding an island is only a matter of writing it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/component";

/**
 * Keeps a reader on the page when they press a link or submit a form inside a live example:
 * those name `/examples/` addresses, and the navigation is cancelled before the runtime
 * reloads the page from one. Registered ahead of `run()`, so it sees each navigation first.
 */
function stayOnExampleNavigation(event: NavigateEvent) {
	if (!event.cancelable) return;
	if (!new URL(event.destination.url).pathname.startsWith("/examples/")) return;
	event.preventDefault();
	event.stopImmediatePropagation();
}

globalThis.navigation?.addEventListener("navigate", stayOnExampleNavigation);

/**
 * Islands shipped by packages, keyed by the bare specifier their client entry names. The
 * renderer writes that specifier as it is, and the browser resolves only URLs, so each one is
 * imported here where the bundler can resolve it.
 */
const PACKAGE_MODULES: Record<string, () => Promise<unknown>> = {
	"@sdxc/ui/dialog-dismiss": () => import("@sdxc/ui/dialog-dismiss"),
};

/**
 * Boots the client runtime and resolves lazily loaded UI modules.
 */
run({
	async loadModule(moduleUrl, exportName) {
		let load = PACKAGE_MODULES[moduleUrl];
		let mod: unknown = load ? await load() : await import(moduleUrl);

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
	 * Sends a submission under the form's declared encoding, coercing a file entry to its
	 * filename for a urlencoded body, and returns the response as-is so the frame can
	 * read its redirect target.
	 */
	async resolveFrame(src, options) {
		let { target, signal, method, formData, encType } = options ?? {};

		let headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
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

		return await fetch(src, {
			credentials: "same-origin",
			cache: "no-cache",
			headers,
			signal,
			method,
			body,
		});
	},
});
