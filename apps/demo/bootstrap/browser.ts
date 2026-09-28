/**
 * Client runtime entry point. Every page the board serves is HTML the browser drives on its
 * own — native dialogs, a plain form — and this file stays wired into the Vite build so
 * linking it from the document layout is the only step adding an island would need.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/ui";

const clientModules = import.meta.glob([
	"!../**/*.server.*",
	"../resources/**/*.{ts,tsx}",
	"../routes/**/*.{ts,tsx}",
]);

/** Boots the client runtime and resolves lazily loaded UI modules. */
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

	/** Sends a frame submission and answers with the response as it stands. */
	async resolveFrame(src, options) {
		let { target, signal, method, formData } = options ?? {};

		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		return await fetch(src, {
			credentials: "same-origin",
			headers,
			signal,
			method,
			body: formData,
		});
	},
});
