/**
 * Client runtime entry. This Worker serves JSON and MCP only today; the module
 * stays wired into the Vite build so a future island can hydrate without a
 * separate client entry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { run } from "remix/component";

/**
 * Modules the runtime may hydrate. Layouts and views stay out so their
 * stylesheets are not shipped twice.
 */
const CLIENT_MODULES = import.meta.glob([
	"!../**/*.server.*",
	"!../**/*.test.*",
	"../resources/components/**/*.{ts,tsx}",
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
});
