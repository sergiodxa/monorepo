/**
 * The suite that says what a flag store is, registered as Vitest tests against
 * whatever the caller constructs. Every store runs it, the one an application
 * writes against its own tables included, which is what makes them substitutes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { FlagStore, StoredFlagSet } from "../store/index.js";

import { FlagStoreError } from "../store/index.js";

/** A set carrying every field a store round trips, so each one is asserted on. */
const FLAG_SET: StoredFlagSet = {
	flags: {
		"new-checkout": {
			variants: { on: true, off: false },
			defaultVariant: "off",
			targeting: [{ when: { op: "segment", name: "internal" }, serve: "on" }],
		},
	},
	segments: { internal: { op: "endsWith", field: "email", value: "@example.com" } },
	version: "17",
};

/** A second set, so a write can be asserted to replace rather than to merge. */
const OTHER_FLAG_SET: StoredFlagSet = {
	flags: { "welcome-banner": { variants: { on: true, off: false } } },
	version: "18",
};

/** Text no store wrote, which is how a set arrives unreadable in practice. */
const NOT_JSON = "{oops";

/** JSON holding something other than a set, the other way a value goes wrong. */
const NOT_AN_OBJECT = "[]";

/** What the suite needs to exercise a store. */
export interface ConformanceOptions<Store extends FlagStore = FlagStore> {
	/** Store name, which labels the registered suite. */
	name: string;

	/**
	 * Builds the store under test, holding nothing. It is called for every test, so a
	 * store over shared storage points each one at a location of its own.
	 */
	create: () => Store | Promise<Store>;

	/**
	 * Puts the set where the store reads it from, by whatever means the storage gives.
	 * A store with a write of its own seeds through it, and a read-only store seeds
	 * through the file, endpoint or object behind it.
	 */
	seed: (store: Store, set: StoredFlagSet) => void | Promise<void>;

	/**
	 * Stores the set through the store's own write. Supplying it registers the round
	 * trip assertions, which say a store reads back what it was told to hold.
	 */
	write?: (store: Store, set: StoredFlagSet) => void | Promise<void>;

	/**
	 * Puts text where the store reads it from, in place of anything the store would
	 * serialize. Supplying it registers the assertions about a value the store did not
	 * write, which is where a store either reports or throws.
	 */
	writeText?: (store: Store, text: string) => void | Promise<void>;
}

/**
 * Registers the suite every flag store has to pass.
 *
 * @param options The store under test, and the capabilities it has beyond reading.
 * @example conformance({ name: "worker-kv", create: () => new WorkerKVFlagStore(env.FLAGS), seed })
 */
export function conformance<Store extends FlagStore>({
	name,
	create,
	seed,
	write,
	writeText,
}: ConformanceOptions<Store>): void {
	/** The error a read answered with, asserting that it answered with one. */
	let errorOf = <T>(result: Result<T, FlagStoreError>): FlagStoreError => {
		if (isSuccess(result)) throw new Error("expected a failure, got a success");
		return result.error;
	};

	describe(`${name} conformance`, () => {
		test("reads a store holding nothing as an empty set", async () => {
			let store = await create();

			expect(unwrap(await store.read()).flags).toStrictEqual({});
		});

		test("reads back the flags and segments it holds", async () => {
			let store = await create();
			await seed(store, FLAG_SET);

			let set = unwrap(await store.read());

			expect(set.flags).toStrictEqual(FLAG_SET.flags);
			expect(set.segments).toStrictEqual(FLAG_SET.segments);
		});

		test("carries the version the set was stored with", async () => {
			let store = await create();
			await seed(store, FLAG_SET);

			expect(unwrap(await store.read()).version).toBe(FLAG_SET.version);
		});

		test("answers every read with the same set", async () => {
			let store = await create();
			await seed(store, FLAG_SET);

			let first = unwrap(await store.read());
			let second = unwrap(await store.read());

			expect(second).toStrictEqual(first);
		});

		test("hands over a set the caller owns", async () => {
			let store = await create();
			await seed(store, FLAG_SET);

			let read = unwrap(await store.read());
			read.flags["injected"] = { variants: { on: true } };

			expect(unwrap(await store.read()).flags).toStrictEqual(FLAG_SET.flags);
		});

		if (write !== undefined) {
			test("reads back exactly what it wrote", async () => {
				let store = await create();
				await write(store, FLAG_SET);

				expect(unwrap(await store.read())).toStrictEqual(FLAG_SET);
			});

			test("replaces the set it was already holding", async () => {
				let store = await create();
				await seed(store, FLAG_SET);
				await write(store, OTHER_FLAG_SET);

				expect(unwrap(await store.read())).toStrictEqual(OTHER_FLAG_SET);
			});

			test("reads an empty set back once it writes one", async () => {
				let store = await create();
				await seed(store, FLAG_SET);
				await write(store, { flags: {} });

				expect(unwrap(await store.read()).flags).toStrictEqual({});
			});
		}

		if (writeText === undefined) return;

		test("reports a stored value that is not JSON", async () => {
			let store = await create();
			await writeText(store, NOT_JSON);

			let error = errorOf(await store.read());

			expect(error).toBeInstanceOf(FlagStoreError);
			expect(error.code).toBe("invalid_value");
		});

		test("reports stored JSON that is not a set", async () => {
			let store = await create();
			await writeText(store, NOT_AN_OBJECT);

			expect(errorOf(await store.read()).code).toBe("invalid_value");
		});

		test("reads normally again once the value is replaced", async () => {
			let store = await create();
			await writeText(store, NOT_JSON);
			await seed(store, FLAG_SET);

			expect(unwrap(await store.read()).flags).toStrictEqual(FLAG_SET.flags);
		});
	});
}
