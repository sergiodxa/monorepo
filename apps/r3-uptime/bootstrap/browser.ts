/**
 * Browser entry point that hydrates the r3-uptime client. It globs the resources and
 * routes modules, then runs the remix/ui client with a loader that dynamically
 * imports the requested client-entry module by URL and a resolver that fetches SSR
 * frame HTML. It exists as the single script the SSR document loads to bring the
 * server-rendered UI to life on the client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/ui";

import { consumePrefetchedFrame } from "~/resources/frame-prefetch";

const clientModules = import.meta.glob([
	"!../**/*.server.*",
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
	async resolveFrame(src, signal, target) {
		let prefetched = consumePrefetchedFrame(src);
		if (prefetched) {
			let response = await prefetched;
			return response.body ?? response.text();
		}

		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		let response = await fetch(src, { credentials: "same-origin", headers, signal });
		return response.body ?? response.text();
	},
});
