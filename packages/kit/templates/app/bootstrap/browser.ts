/**
 * The browser's entry point: boots the Remix component runtime and resolves the island
 * modules a server-rendered page hydrates. A page with no island links no script, so this
 * file only runs where an island asks for it.
 */

import { run } from "remix/component";

/**
 * The island modules a hydration record can name, keyed by the module URL the island writes.
 * Each one is listed here, so a server-rendered component never becomes a client chunk by
 * sitting next to one that hydrates.
 */
const CLIENT_MODULES: Record<string, () => Promise<Record<string, unknown>>> = {};

run({
	/** Resolves a hydrated island's export from the module URL the server wrote. */
	async loadModule(moduleUrl, exportName) {
		let load = CLIENT_MODULES[moduleUrl];
		if (load === undefined) throw new Error(`Unknown client entry module: ${moduleUrl}`);
		let entry = (await load())[exportName];
		if (typeof entry !== "function") {
			throw new Error(`Missing client entry export ${exportName} in ${moduleUrl}`);
		}
		return entry;
	},
});
