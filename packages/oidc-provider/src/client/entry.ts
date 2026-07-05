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
	async resolveFrame(src, signal, target) {
		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		let res = await fetch(src, { headers, signal });
		return await res.text();
	},
});

await app.ready();
