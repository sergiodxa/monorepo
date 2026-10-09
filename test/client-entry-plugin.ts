/**
 * Vite plugin that gives `clientEntry(import.meta.url, …)` islands under Vitest the same
 * `file:<path>#Name` identity the Remix Vite plugin writes into a build, so a test render
 * resolves each island through the asset manifest exactly as production does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { relative, sep } from "node:path";

import type { Plugin } from "vite";

/** The one form the build rewrites: a named, top-level export whose identity is its module URL. */
const CLIENT_ENTRY_CALL =
	/(export\s+(?:const|let)\s+(\w+)\s*=\s*clientEntry\(\s*)import\.meta\.url/g;

/**
 * @returns A Vite plugin rewriting island identities relative to the project's root.
 */
export function clientEntryIdentity(): Plugin {
	let root = process.cwd();

	return {
		name: "client-entry-identity",

		/**
		 * Reads the project's root, which the identity's path is relative to.
		 * @param config The resolved Vite config.
		 */
		configResolved(config) {
			root = config.root;
		},

		/**
		 * Swaps `import.meta.url` for the module's `file:` identity in every island export.
		 * @param code Module source.
		 * @param id Resolved module id.
		 */
		transform(code: string, id: string) {
			if (!code.includes("clientEntry") || !code.includes("import.meta.url")) return undefined;

			let key = relative(root, id.split("?", 1)[0] ?? id)
				.split(sep)
				.join("/");
			let rewritten = code.replace(
				CLIENT_ENTRY_CALL,
				(_match, head: string, name: string) => `${head}${JSON.stringify(`file:${key}#${name}`)}`,
			);

			return rewritten === code ? undefined : { code: rewritten, map: null };
		},
	};
}
