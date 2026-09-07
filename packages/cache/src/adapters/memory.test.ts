/**
 * Runs the shared conformance suite against the memory cache, and asserts what
 * it does beyond the contract: it holds serialized text rather than the object
 * it was handed, so a value read back is a copy that made the round trip.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { conformance } from "../testing/conformance.js";

import { MemoryCache } from "./memory.js";

/** Milliseconds the injectable clock starts at, fixed so a test reads the same time twice. */
const EPOCH = 1_757_203_200_000;

describe("MemoryCache", () => {
	let clock = { now: EPOCH };

	conformance({
		name: "MemoryCache",
		create() {
			clock = { now: EPOCH };
			return new MemoryCache({ now: () => clock.now });
		},
		expire(seconds) {
			clock.now += seconds * 1000;
		},
	});

	test("stores a copy, so a later mutation of the written object is not read back", async () => {
		let cache = new MemoryCache();
		let value = { tags: ["news"] };

		unwrap(await cache.write("key", value));
		value.tags.push("later");

		expect(unwrap(await cache.read("key"))).toStrictEqual({ tags: ["news"] });
	});

	test("hands back a copy, so a mutation of what was read is not stored", async () => {
		let cache = new MemoryCache();
		unwrap(await cache.write("key", { tags: ["news"] }));

		let first = unwrap(await cache.read<{ tags: string[] }>("key"));
		first?.tags.push("later");

		expect(unwrap(await cache.read("key"))).toStrictEqual({ tags: ["news"] });
	});

	test("tells the time with Date.now when no clock is given", async () => {
		let cache = new MemoryCache();

		unwrap(await cache.write("key", "value", { ttl: 60 }));

		expect(unwrap(await cache.read("key"))).toBe("value");
	});
});
