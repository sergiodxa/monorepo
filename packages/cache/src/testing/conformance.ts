/**
 * The suite that says what a cache is, registered as Vitest tests against
 * whatever the caller constructs. Every adapter runs it, which is what makes one
 * a substitute for another rather than something that merely resembles it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test, vi } from "vitest";

import type { Cache, CacheError } from "../index.js";

/**
 * The shortest TTL the suite asks for. KV refuses anything under 60 seconds, so
 * a suite every adapter can pass cannot assert a shorter lifetime than that.
 */
const MIN_TTL_SECONDS = 60;

/** What the suite needs to exercise an adapter. */
export interface ConformanceOptions {
	/** Adapter name, which labels the registered suite. */
	name: string;

	/**
	 * Builds the cache under test. It is called for every test, so an adapter
	 * holding mutable state starts each one clean.
	 */
	create: () => Cache | Promise<Cache>;

	/**
	 * Moves the adapter's clock forward, which is what an expiry assertion needs.
	 * An adapter that can only expire in real time leaves it out, and the suite
	 * registers the expiry tests against the adapters that can.
	 */
	expire?: (seconds: number) => void | Promise<void>;
}

/**
 * Registers the suite every cache has to pass.
 *
 * @param options The adapter under test.
 */
export function conformance({ name, create, expire }: ConformanceOptions): void {
	/** A key no other test has used, so adapters sharing a store cannot collide. */
	let key = (): string => `conformance:${crypto.randomUUID()}`;

	/** The error a call answered with, asserting that it answered with one. */
	let errorOf = <T>(result: Result<T, CacheError>): CacheError => {
		if (isSuccess(result)) throw new Error("expected a failure, got a success");
		return result.error;
	};

	describe(`${name} conformance`, () => {
		test("reads back what was written", async () => {
			let cache = await create();
			let k = key();

			unwrap(await cache.write(k, { id: 1, tags: ["news"] }));

			expect(unwrap(await cache.read(k))).toStrictEqual({ id: 1, tags: ["news"] });
		});

		test("succeeds with null for a key it holds nothing for", async () => {
			let cache = await create();

			expect(unwrap(await cache.read(key()))).toBeNull();
		});

		test("is readable as soon as a write resolves", async () => {
			let cache = await create();
			let k = key();

			unwrap(await cache.write(k, "value"));

			expect(unwrap(await cache.read(k))).toBe("value");
		});

		test("replaces the value a key already holds", async () => {
			let cache = await create();
			let k = key();

			unwrap(await cache.write(k, "first"));
			unwrap(await cache.write(k, "second"));

			expect(unwrap(await cache.read(k))).toBe("second");
		});

		test("removes an entry, and removing a missing one succeeds", async () => {
			let cache = await create();
			let k = key();

			unwrap(await cache.write(k, "value"));
			unwrap(await cache.delete(k));
			unwrap(await cache.delete(k));

			expect(unwrap(await cache.read(k))).toBeNull();
		});

		test("returns what it holds without computing", async () => {
			let cache = await create();
			let k = key();
			let load = vi.fn(async () => "computed");

			unwrap(await cache.write(k, "stored"));

			expect(unwrap(await cache.fetch(k, load))).toBe("stored");
			expect(load).not.toHaveBeenCalled();
		});

		test("computes once on a miss and stores what it computed", async () => {
			let cache = await create();
			let k = key();
			let load = vi.fn(async () => "computed");

			expect(unwrap(await cache.fetch(k, load))).toBe("computed");
			expect(unwrap(await cache.fetch(k, load))).toBe("computed");
			expect(load).toHaveBeenCalledTimes(1);
		});

		test("answers a hit and a miss with the same type", async () => {
			let cache = await create();
			let k = key();
			let load = async () => ({ at: new Date("2026-09-07T00:00:00.000Z") });

			let miss = unwrap(await cache.fetch(k, load));
			let hit = unwrap(await cache.fetch(k, load));

			expect(miss).toStrictEqual({ at: "2026-09-07T00:00:00.000Z" });
			expect(hit).toStrictEqual(miss);
		});

		test("counts a stored null as a hit", async () => {
			let cache = await create();
			let k = key();
			let load = vi.fn(async () => null);

			expect(unwrap(await cache.fetch(k, load))).toBeNull();
			expect(unwrap(await cache.fetch(k, load))).toBeNull();
			expect(load).toHaveBeenCalledTimes(1);
		});

		test("reports a failed loader as load_failed, carrying what it threw", async () => {
			let cache = await create();
			let thrown = new Error("loader failed");

			let error = errorOf(
				await cache.fetch(key(), async () => {
					throw thrown;
				}),
			);

			expect(error.code).toBe("load_failed");
			expect(error.cause).toBe(thrown);
		});

		test("reports a value JSON cannot write as invalid_value", async () => {
			let cache = await create();
			let cyclic: unknown[] = [];
			cyclic.push(cyclic);

			expect(errorOf(await cache.write(key(), cyclic)).code).toBe("invalid_value");
			expect(errorOf(await cache.fetch(key(), async () => cyclic)).code).toBe("invalid_value");
		});

		test("names the key on every failure it reports", async () => {
			let cache = await create();
			let k = key();

			let error = errorOf(
				await cache.fetch(k, async () => {
					throw new Error("loader failed");
				}),
			);

			expect(error.key).toBe(k);
		});

		test("keeps an entry written without a ttl", async () => {
			let cache = await create();
			let k = key();

			unwrap(await cache.write(k, "value"));

			expect(unwrap(await cache.read(k))).toBe("value");
		});

		if (expire === undefined) return;

		test("hides an entry once its ttl has passed", async () => {
			let cache = await create();
			let k = key();

			unwrap(await cache.write(k, "value", { ttl: MIN_TTL_SECONDS }));
			await expire(MIN_TTL_SECONDS);

			expect(unwrap(await cache.read(k))).toBeNull();
		});

		test("keeps an entry until its ttl has passed", async () => {
			let cache = await create();
			let k = key();

			unwrap(await cache.write(k, "value", { ttl: MIN_TTL_SECONDS }));
			await expire(MIN_TTL_SECONDS - 1);

			expect(unwrap(await cache.read(k))).toBe("value");
		});

		test("counts a duration string and its seconds as the same lifetime", async () => {
			let cache = await create();
			let seconds = key();
			let duration = key();

			unwrap(await cache.write(seconds, "value", { ttl: 60 }));
			unwrap(await cache.write(duration, "value", { ttl: "1 minute" }));
			await expire(MIN_TTL_SECONDS);

			expect(unwrap(await cache.read(seconds))).toBeNull();
			expect(unwrap(await cache.read(duration))).toBeNull();
		});

		test("recomputes through fetch once the entry has expired", async () => {
			let cache = await create();
			let k = key();
			let load = vi.fn(async () => "computed");

			unwrap(await cache.fetch(k, load, { ttl: MIN_TTL_SECONDS }));
			await expire(MIN_TTL_SECONDS);
			unwrap(await cache.fetch(k, load, { ttl: MIN_TTL_SECONDS }));

			expect(load).toHaveBeenCalledTimes(2);
		});
	});
}
