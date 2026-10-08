/**
 * Holds `CacheSeenActivities` to the package's seen-activities conformance suite over a
 * `MemoryCache` with a movable clock, and pins the TTL floor, key prefix and failure handling
 * that keep it usable over Workers KV.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CacheWriteOptions } from "@sdxc/cache";
import type { Result } from "@sdxc/result";

import { CacheError } from "@sdxc/cache";
import { MemoryCache } from "@sdxc/cache/memory";
import { failure, isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { CacheSeenActivities } from "./seen-activities.js";
import { seenActivitiesConformance } from "./testing.js";

/** Milliseconds the injectable clock starts at, fixed so a test reads the same time twice. */
const EPOCH = 1_757_203_200_000;

const ID = "https://remote.com/activities/1";

let clock = { now: EPOCH };

/** A `MemoryCache` that keeps every write it is handed, so a test reads the TTL a claim set. */
class RecordingCache extends MemoryCache {
	writes: Array<{ key: string; options: CacheWriteOptions | undefined }> = [];

	override async write<T>(
		key: string,
		value: T,
		options?: CacheWriteOptions,
	): Promise<Result<void, CacheError>> {
		this.writes.push({ key, options });
		return super.write(key, value, options);
	}
}

/** A cache that cannot be reached for reads. */
class UnreadableCache extends MemoryCache {
	override async read(key: string): Promise<Result<null, CacheError>> {
		return failure(new CacheError("down", { code: "unavailable", key }));
	}
}

/** A cache that refuses every write while reading normally. */
class ReadOnlyCache extends MemoryCache {
	override async write(key: string): Promise<Result<void, CacheError>> {
		return failure(new CacheError("full", { code: "unavailable", key }));
	}
}

seenActivitiesConformance({
	name: "CacheSeenActivities",
	create: () => {
		clock = { now: EPOCH };
		return new CacheSeenActivities(new MemoryCache({ now: () => clock.now }));
	},
	advance: (ms) => {
		clock.now += ms;
	},
});

describe("CacheSeenActivities", () => {
	test("holds a claim shorter than a minute for a minute", async () => {
		let cache = new RecordingCache();
		let seen = new CacheSeenActivities(cache);

		expect(unwrap(await seen.claim(ID, "5 seconds"))).toBe(true);
		expect(cache.writes[0]?.options).toEqual({ ttl: 60 });
	});

	test("rounds a claim up to whole seconds, reading a bare number as milliseconds", async () => {
		let cache = new RecordingCache();
		let seen = new CacheSeenActivities(cache);

		unwrap(await seen.claim(ID, 90_500));
		unwrap(await seen.claim(`${ID}/2`, "90500ms"));

		expect(cache.writes.map((write) => write.options)).toEqual([{ ttl: 91 }, { ttl: 91 }]);
	});

	test("keeps its claims under the activitypub:seen: prefix", async () => {
		let cache = new RecordingCache();
		let seen = new CacheSeenActivities(cache);

		unwrap(await seen.claim(ID, "1 hour"));

		expect(cache.writes[0]?.key).toBe(`activitypub:seen:${ID}`);
		expect(unwrap(await cache.read(`activitypub:seen:${ID}`))).not.toBeNull();
	});

	test("refuses a TTL that is not a positive duration", async () => {
		let seen = new CacheSeenActivities(new MemoryCache());

		expect(isFailure(await seen.claim(ID, 0))).toBe(true);
		expect(isFailure(await seen.claim(ID, -5))).toBe(true);
	});

	test("fails when the cache cannot be read", async () => {
		let seen = new CacheSeenActivities(new UnreadableCache());

		expect(isFailure(await seen.claim(ID, "1 hour"))).toBe(true);
	});

	test("answers true when the cache refuses the write", async () => {
		let seen = new CacheSeenActivities(new ReadOnlyCache());

		expect(unwrap(await seen.claim(ID, "1 hour"))).toBe(true);
	});
});
