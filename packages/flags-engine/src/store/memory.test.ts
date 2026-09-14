/**
 * Runs the shared conformance suite against the in-memory store, and holds it to
 * answering a read without a promise, which is the property a worker with its
 * definitions compiled in relies on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { conformance } from "../testing/conformance.js";

import { InMemoryFlagStore } from "./memory.js";

/** A definition the tests store and read back, shaped as the engine parses one. */
const DEFINITION = { variants: { on: true, off: false }, defaultVariant: "off" };

conformance({
	name: "InMemoryFlagStore",
	create: () => new InMemoryFlagStore(),
	seed: (store, set) => store.write(set),
	write: (store, set) => store.write(set),
});

describe("InMemoryFlagStore", () => {
	test("answers a read without a promise", () => {
		let store = new InMemoryFlagStore({ flags: { "new-checkout": DEFINITION } });

		let result = store.read();

		expect(result).not.toBeInstanceOf(Promise);
		expect(unwrap(result).flags).toStrictEqual({ "new-checkout": DEFINITION });
	});

	test("starts out empty when constructed with no set", () => {
		expect(unwrap(new InMemoryFlagStore().read()).flags).toStrictEqual({});
	});

	test("reads the set written most recently", () => {
		let store = new InMemoryFlagStore({ flags: { "new-checkout": DEFINITION } });

		store.write({ flags: {}, version: "2" });

		expect(unwrap(store.read())).toStrictEqual({ flags: {}, version: "2" });
	});

	test("leaves a set already read as it was read", () => {
		let store = new InMemoryFlagStore({ flags: { "new-checkout": DEFINITION } });

		let before = unwrap(store.read());
		store.write({ flags: {} });

		expect(before.flags).toStrictEqual({ "new-checkout": DEFINITION });
	});
});
