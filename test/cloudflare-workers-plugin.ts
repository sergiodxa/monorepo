/**
 * Vite plugin that resolves the virtual `cloudflare:workers` module, so source files that
 * statically `import { env } from "cloudflare:workers"` load under Vitest without the
 * Workers runtime.
 *
 * This is the Vitest counterpart of the `bun test` preload: same deterministic
 * `test-<KEY>` placeholders, same reason for existing. A test that needs specific bindings
 * still calls `vi.doMock("cloudflare:workers", …)` and dynamically imports its subject,
 * which overrides this default for that file.
 *
 * `waitUntil` and `DurableObject` are exported even though the default does nothing with
 * them: a module's export set is fixed at link time, so a source file that statically
 * imports either fails to load against a stub that omits it, before any `vi.doMock` can
 * replace it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Plugin } from "vite";

/** The specifier source files import. */
const SPECIFIER = "cloudflare:workers";

/** Rollup convention: a leading NUL marks an id no other plugin should try to load. */
const RESOLVED = `\0${SPECIFIER}`;

/**
 * Builds the plugin.
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
		 * Serves the stub's source.
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
