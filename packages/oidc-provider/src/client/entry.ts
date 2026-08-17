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
	async resolveFrame(src, options) {
		let { target, signal, method, formData, encType } = options ?? {};

		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		// A form that declares the default encoding is sent as one, so the server reads
		// the body under the type the form asked for rather than the multipart type
		// `fetch` picks for `FormData`. A file entry carries only its name under this
		// encoding, matching what a native urlencoded submission sends.
		let body =
			formData && encType === "application/x-www-form-urlencoded"
				? new URLSearchParams(
						Array.from(formData, ([key, value]) => [
							key,
							typeof value === "string" ? value : value.name,
						]),
					)
				: formData;

		// The response itself carries the URL it was redirected to, which the frame
		// reads to update its own source after a submission.
		return await fetch(src, { headers, signal, method, body });
	},
});

await app.ready();
