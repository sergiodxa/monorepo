/**
 * Bun test preload for `apps/auth-saas`. Registers a virtual `cloudflare:workers`
 * module so source files that read `env` (Polar/Cloudflare tokens, `HOSTNAMES_KV`)
 * can be imported under `bun test` without the Workers runtime. Tests never hit the
 * network; the stub only satisfies the module graph and lets specs record KV calls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { plugin } from "bun";

/**
 * Records every `HOSTNAMES_KV` operation performed during a test so specs can
 * assert cache invalidation without a live KV namespace. Reset it in `beforeEach`
 * from the test file that reads it.
 */
export let kvOperations: Array<{ op: "get" | "put" | "delete"; key: string }> = [];

/** In-memory backing store for the stubbed `HOSTNAMES_KV` namespace. */
let kvStore = new Map<string, string>();

/** Clears the recorded KV operations and backing store between tests. */
export function resetKv(): void {
	kvOperations = [];
	kvStore.clear();
}

let hostnamesKv = {
	async get(key: string): Promise<string | null> {
		kvOperations.push({ op: "get", key });
		return kvStore.get(key) ?? null;
	},
	async put(key: string, value: string): Promise<void> {
		kvOperations.push({ op: "put", key });
		kvStore.set(key, value);
	},
	async delete(key: string): Promise<void> {
		kvOperations.push({ op: "delete", key });
		kvStore.delete(key);
	},
};

/**
 * Deterministic stand-in for the Workers `env`. Known bindings return fixed test
 * values; the `HOSTNAMES_KV` binding is the recording namespace above. Any other
 * key resolves to a `test-<KEY>` string so unrelated reads never throw.
 */
let env = new Proxy({ HOSTNAMES_KV: hostnamesKv } as Record<string, unknown>, {
	get(target, prop: string) {
		if (prop in target) return target[prop];
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
