/**
 * Client-side entry for the hosted pages. Boots the `remix/component` runtime so
 * server-rendered pages hydrate their islands, each loaded from the chunk the renderer named
 * for its `clientEntry(import.meta.url)` identity, and resolves `<Frame>` navigations.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/component";

run({
	/**
	 * Resolves a hydrated `clientEntry()` module URL to its named browser export.
	 *
	 * @param moduleUrl - The module URL encoded in the `clientEntry()` id.
	 * @param exportName - The export to pull from the resolved module.
	 * @returns The requested export (expected to be a component function).
	 */
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
	 * Fetches the markup for a browser-loaded `<Frame>`, forwarding the frame target so
	 * the server can render just that frame, and the submission that triggered a
	 * reload so a form inside a frame reaches the server as the form it was.
	 *
	 * @param src - The `<Frame src>` value to load.
	 * @param options - Target, abort signal, and submission for the active frame load.
	 * @returns The frame's response, whose body is rendered into the frame.
	 */
	async resolveFrame(src, options) {
		let { target, signal, method, formData, encType } = options ?? {};

		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		/**
		 * A form that declares the default encoding is sent as one, so the server
		 * reads the body under the encoding the form asked for.
		 */
		let body =
			formData && encType === "application/x-www-form-urlencoded"
				? new URLSearchParams(
						/**
						 * A file entry contributes its filename to a urlencoded
						 * submission — the only representation the server can act on.
						 */
						Array.from(formData, ([key, value]) => [
							key,
							value instanceof File ? value.name : value,
						]),
					)
				: formData;

		/**
		 * The response carries the URL it was redirected to, which the frame
		 * reads to update its own source after a submission.
		 */
		return await fetch(src, { credentials: "same-origin", headers, signal, method, body });
	},
});
