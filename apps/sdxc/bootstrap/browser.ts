/**
 * Client runtime entry point. The landing page is server-rendered HTML; the runtime
 * is here for the copy buttons, which need script to reach the clipboard, and stays
 * wired into the build so adding another island is only a matter of writing it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/component";

/**
 * Modules the runtime may hydrate: the islands, each a `clientEntry()` module under
 * `resources/components/`. Layouts, views and the server-rendered components stay out, since
 * bundling them would compile the document's stylesheets a second time, a copy every page
 * would then link, and give each its own chunk in the import map every page carries.
 */
const CLIENT_MODULES = import.meta.glob([
	"../resources/components/previews/*.tsx",
	"../resources/components/previews/*/*.tsx",
	"../resources/components/copy-button.tsx",
	"../resources/components/copy-markdown.tsx",
	"../resources/components/drawer-dismiss.tsx",
	"../resources/components/option-groups.tsx",
	"../resources/components/search-palette.tsx",
	"../resources/components/table-of-contents.tsx",
]);

/**
 * Boots the client runtime and resolves lazily loaded UI modules.
 */
run({
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
	 * Sends a submission under the form's declared encoding, coercing a file entry to
	 * its filename for a urlencoded body, and returns the response as-is so the frame
	 * can read its redirect target.
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
