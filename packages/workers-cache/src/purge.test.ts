/**
 * Covers standalone purging through a recording cache: the three selector forms,
 * tag deduplication, the option shapes that would invalidate nothing, and that a
 * platform rejection comes back as a failure naming what stayed stale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@pkg/result";
import { describe, expect, test } from "vitest";

import type { CacheTag, PurgeOptions } from "./types";

import { createTags } from "./create-tags";
import { purge } from "./purge";
import { PurgeError } from "./purge-error";
import { createRecordingCache } from "./recording-cache";

const TAGS = createTags({
	post: (id: string) => `post:${id}`,
	postList: () => "posts",
});

describe("purge", () => {
	test("sends a tag selector and reports success", async () => {
		let cache = createRecordingCache();

		let result = await purge(cache, { tags: [TAGS.post("1"), TAGS.postList()] });

		expect(isSuccess(result)).toBe(true);
		expect(cache.purges).toEqual([{ tags: ["post:1", "posts"] }]);
	});

	test("collapses repeated tags before calling the platform", async () => {
		let cache = createRecordingCache();

		await purge(cache, { tags: [TAGS.postList(), TAGS.postList(), TAGS.post("2")] });

		expect(cache.purgedTags).toEqual(["posts", "post:2"]);
	});

	test("sends a prefix selector", async () => {
		let cache = createRecordingCache();

		let result = await purge(cache, { prefix: "example.com/blog/" });

		expect(isSuccess(result)).toBe(true);
		expect(cache.purges).toEqual([{ prefix: "example.com/blog/" }]);
	});

	test("sends an everything selector", async () => {
		let cache = createRecordingCache();

		let result = await purge(cache, { everything: true });

		expect(isSuccess(result)).toBe(true);
		expect(cache.purges).toEqual([{ everything: true }]);
	});

	test("fails an empty tag list without calling the platform", async () => {
		let cache = createRecordingCache();

		let result = await purge(cache, { tags: [] });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(PurgeError);
		expect(cache.purges).toEqual([]);
	});

	test("fails a blank prefix without calling the platform", async () => {
		let cache = createRecordingCache();

		let result = await purge(cache, { prefix: "   " });

		expect(isFailure(result)).toBe(true);
		expect(cache.purges).toEqual([]);
	});

	test("fails options that select nothing", async () => {
		let cache = createRecordingCache();

		let result = await purge(cache, { everything: false } as unknown as PurgeOptions);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("selected nothing");
		expect(cache.purges).toEqual([]);
	});

	test("fails a tag that was cast rather than built by a vocabulary", async () => {
		let cache = createRecordingCache();

		let result = await purge(cache, { tags: ["post 1" as CacheTag] });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("invalid tag");
		expect(cache.purges).toEqual([]);
	});

	test("reports a platform rejection as a failure naming the selector", async () => {
		let rejection = new Error("edge unavailable");
		let cache = createRecordingCache({ failWith: rejection });

		let result = await purge(cache, { tags: [TAGS.post("1")] });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(PurgeError);
		expect(result.error.message).toContain("post:1");
		expect(result.error.selector).toEqual({ tags: ["post:1"] });
		expect(result.error.cause).toBe(rejection);
	});

	test("never throws, so a failed purge cannot escape a job's error handling", async () => {
		let cache = createRecordingCache({ failWith: new Error("edge unavailable") });

		let result = await purge(cache, { everything: true });

		expect(isFailure(result)).toBe(true);
	});
});
