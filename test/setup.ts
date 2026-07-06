/**
 * Monorepo-wide Bun test preload. Registers a virtual `cloudflare:workers` module
 * so source files that statically `import { env } from "cloudflare:workers"` can be
 * loaded under `bun test` without the Workers runtime. This is the default stub;
 * a test that needs specific bindings mocks `cloudflare:workers` itself (via
 * `mock.module`) and dynamically imports its subject, which overrides this default
 * for that file. Tests never hit the network; the stub only satisfies the module
 * graph and returns deterministic `test-<KEY>` placeholders for any binding read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { plugin } from "bun";

/**
 * Deterministic stand-in for the Workers `env`. Any binding read resolves to a
 * `test-<KEY>` string so module-load-time reads never throw; tests that assert on a
 * binding provide their own `mock.module` stub instead of relying on these values.
 */
let env = new Proxy({} as Record<string, unknown>, {
	get(_target, prop: string) {
		return `test-${prop}`;
	},
});

plugin({
	name: "cloudflare-workers-stub",
	setup(build) {
		build.module("cloudflare:workers", () => ({
			exports: { env },
			loader: "object",
		}));
	},
});
