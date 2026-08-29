/**
 * Vite plugin that resolves the virtual `cloudflare:workers` module, so source files that
 * statically `import { env } from "cloudflare:workers"` load under Vitest without the
 * Workers runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Plugin } from "vite";

const SPECIFIER = "cloudflare:workers";

/** Rollup convention: a leading NUL marks an id no other plugin should try to load. */
const RESOLVED = `\0${SPECIFIER}`;

/**
 * @returns A Vite plugin serving the `cloudflare:workers` stub.
 */
export function cloudflareWorkersStub(): Plugin {
	return {
		name: "cloudflare-workers-stub",

		/**
		 * Claims the virtual specifier.
		 * @param source Module specifier being resolved.
		 */
		resolveId(source: string): string | undefined {
			return source === SPECIFIER ? RESOLVED : undefined;
		},

		/**
		 * Serves the stub's source. Every binding read answers a deterministic `test-<KEY>`
		 * placeholder, and `waitUntil`/`DurableObject` stay exported even though unused, since
		 * an omitted export breaks a static importer before any override can run.
		 * @param id Resolved module id.
		 */
		load(id: string): string | undefined {
			if (id !== RESOLVED) return undefined;

			return `
export const env = new Proxy({}, { get: (_target, property) => \`test-\${String(property)}\` });

export function waitUntil(promise) {
	Promise.resolve(promise).catch(() => {});
}

export class DurableObject {
	constructor(state, env) {
		this.ctx = state;
		this.env = env;
	}
}
`;
		},
	};
}
