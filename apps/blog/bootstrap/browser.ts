/**
 * Client-side entrypoint for the blog browser bundle. Boots the Remix UI runtime, loading
 * each island from the chunk the renderer named for its `clientEntry(import.meta.url)`
 * identity, and fetches frames over the network as islands reload them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/component";

/**
 * Keeps every link and form a full document navigation: the runtime soft-navigates them
 * otherwise, and swapping a page in place makes Safari repaint it unstyled.
 */
function keepDocumentNavigations() {
	if (!("navigation" in window)) return;
	window.navigation.addEventListener("navigate", (event) => event.stopImmediatePropagation());
}

keepDocumentNavigations();

/**
 * Islands shipped by packages, keyed by the bare specifier their client entry names. The
 * renderer writes that specifier as it is, and the browser resolves only URLs, so each one is
 * imported here where the bundler can resolve it.
 */
const PACKAGE_MODULES: Record<string, () => Promise<unknown>> = {
	"@sdxc/ui/copy-button": () => import("@sdxc/ui/copy-button"),
};

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
