/**
 * Runs the shared conformance suite against a real KV namespace inside workerd,
 * and covers what the binding itself decides: the text a set becomes, and what a
 * key holding something else reads as.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { conformance } from "../testing/conformance.js";

import { WorkerKVFlagStore } from "./worker-kv.js";

/** A set the tests store and read back, carrying every field a store round trips. */
const FLAG_SET = {
	flags: { "new-checkout": { variants: { on: true, off: false }, defaultVariant: "off" } },
	segments: { internal: { op: "endsWith", field: "email", value: "@example.com" } },
	version: "17",
};

/** A key no other test has taken, since every test in the file shares one namespace. */
function key(): string {
	return `flags:${crypto.randomUUID()}`;
}

conformance({
	name: "WorkerKVFlagStore",
	create: () => new WorkerKVFlagStore(env.FLAGS, { key: key() }),
	seed: (store, set) => env.FLAGS.put(store.key, JSON.stringify(set)),
	async write(store, set) {
		unwrap(await store.write(set));
	},
	writeText: (store, text) => env.FLAGS.put(store.key, text),
});

describe("WorkerKVFlagStore over the namespace", () => {
	test("stores the whole set as one JSON value under its key", async () => {
		let store = new WorkerKVFlagStore(env.FLAGS, { key: key() });

		unwrap(await store.write(FLAG_SET));

		expect(await env.FLAGS.get(store.key, "text")).toBe(JSON.stringify(FLAG_SET));
	});

	test("reads a set another writer put in the namespace", async () => {
		let store = new WorkerKVFlagStore(env.FLAGS, { key: key() });
		await env.FLAGS.put(store.key, JSON.stringify(FLAG_SET));

		expect(unwrap(await store.read())).toStrictEqual(FLAG_SET);
	});

	test("reads a key the namespace holds nothing for as an empty set", async () => {
		let store = new WorkerKVFlagStore(env.FLAGS, { key: key() });

		expect(unwrap(await store.read())).toStrictEqual({ flags: {} });
	});

	test("names the key it read when the value stored there is not JSON", async () => {
		let store = new WorkerKVFlagStore(env.FLAGS, { key: key() });
		await env.FLAGS.put(store.key, "not json at all");

		let result = await store.read();

		expect(isFailure(result) && result.error.code).toBe("invalid_value");
		expect(isFailure(result) && result.error.location).toBe(store.key);
	});

	test("takes flags as its key when the caller names none", async () => {
		let store = new WorkerKVFlagStore(env.FLAGS);

		unwrap(await store.write({ flags: {}, version: "default-key" }));

		expect(store.key).toBe("flags");
		expect(await env.FLAGS.get("flags", "text")).toBe(`{"flags":{},"version":"default-key"}`);
	});
});
