/**
 * Browser entry point for the provider's tenant-facing pages.
 *
 * Bootstraps the remix/ui client runtime, wiring up dynamic module loading and
 * frame resolution so hydrated components (e.g. the WebAuthn flows) can fetch and
 * mount on the client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/ui";

let app = run({
	async loadModule(moduleUrl, exportName) {
		let mod = await import(moduleUrl);
		return mod[exportName];
	},
	/**
	 * Re-encodes an urlencoded form's `FormData` into `URLSearchParams`, since
	 * the server reads the body under the encoding the form declared rather
	 * than the multipart type `fetch` sends for `FormData`.
	 * @returns The fetch response, whose URL the frame reads to update its own source.
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

		return await fetch(src, { headers, signal, method, body });
	},
});

await app.ready();
