/**
 * Tests for env assembly: supplied bindings come back as themselves, and a binding the
 * test forgot fails by name at the read instead of surfacing far away as `undefined`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createD1Database } from "./d1";
import { createEnv } from "./env";
import { createKVNamespace } from "./kv";

/** Binding shape a Worker under test would have generated. */
interface TestEnv {
	/** SQL database binding. */
	DB: D1Database;
	/** Cache namespace binding. */
	CACHE: KVNamespace;
}

describe("createEnv", () => {
	test("exposes the bindings it was given", () => {
		let db = createD1Database();
		let cache = createKVNamespace();

		let env = createEnv<TestEnv>({ DB: db, CACHE: cache });

		expect(env.DB).toBe(db);
		expect(env.CACHE).toBe(cache);
	});

	test("throws by name when a binding was never supplied", () => {
		let env = createEnv<TestEnv>({ CACHE: createKVNamespace() });

		expect(() => env.DB).toThrow(/env.DB was not provided/);
	});

	test("returns undefined for a missing binding when strict is off", () => {
		let env = createEnv<TestEnv>({ CACHE: createKVNamespace() }, { strict: false });

		expect(env.DB).toBeUndefined();
	});

	test("stays awaitable and inspectable despite the strict read guard", async () => {
		let env = createEnv({ CACHE: createKVNamespace() });

		/**
		 * A strict proxy must not break the probes runtimes and matchers perform: resolving
		 * a value reads `then` off it, which a naive guard would reject as a missing binding.
		 */
		expect(await Promise.resolve(env)).toBeDefined();
		expect(Object.keys(env)).toEqual(["CACHE"]);
		expect("DB" in env).toBe(false);
	});

	test("copies the bindings object, so later mutation does not leak in", () => {
		let bindings: Record<string, unknown> = { CACHE: createKVNamespace() };
		let env = createEnv(bindings);

		bindings.EXTRA = "added later";

		expect(() => (env as Record<string, unknown>).EXTRA).toThrow(/not provided/);
	});

	test("accepts arbitrary string values alongside bindings", () => {
		let env = createEnv({ SECRET: "shhh" });

		expect(env.SECRET).toBe("shhh");
	});
	test("reads a binding defined as a getter every time, rather than snapshotting it", () => {
		let current = createKVNamespace();
		let env = createEnv<{ CACHE: KVNamespace }>({
			get CACHE(): KVNamespace {
				return current;
			},
		});

		expect(env.CACHE).toBe(current);

		/**
		 * A test that swaps the binding between cases must see the replacement, which a
		 * spread of the bindings object would have frozen out.
		 */
		current = createKVNamespace();
		expect(env.CACHE).toBe(current);
	});
});
