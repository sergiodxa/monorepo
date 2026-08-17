/**
 * Covers the recording cache double: that it captures selectors in call order,
 * flattens purged tags for assertions, records the call it then fails, and can be
 * reset so one instance serves several cases in a test file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { createRecordingCache } from "./recording-cache";

describe("createRecordingCache", () => {
	test("records selectors in call order", async () => {
		let cache = createRecordingCache();

		await cache.purge({ tags: ["posts"] });
		await cache.purge({ prefix: "example.com/blog/" });

		expect(cache.purges).toEqual([{ tags: ["posts"] }, { prefix: "example.com/blog/" }]);
	});

	test("flattens the tags across every tag purge", async () => {
		let cache = createRecordingCache();

		await cache.purge({ tags: ["post:1", "posts"] });
		await cache.purge({ everything: true });
		await cache.purge({ tags: ["post:2"] });

		expect(cache.purgedTags).toEqual(["post:1", "posts", "post:2"]);
	});

	test("records the call before failing, so a failure is still observable", async () => {
		let cache = createRecordingCache({ failWith: new Error("edge unavailable") });

		expect(cache.purge({ tags: ["posts"] })).rejects.toThrow("edge unavailable");
		expect(cache.purges).toEqual([{ tags: ["posts"] }]);
	});

	test("starts failing when asked to", async () => {
		let cache = createRecordingCache();

		await cache.purge({ tags: ["posts"] });
		cache.failWith(new Error("edge unavailable"));

		expect(cache.purge({ tags: ["posts"] })).rejects.toThrow("edge unavailable");
	});

	test("resets recorded calls and any configured failure", async () => {
		let cache = createRecordingCache({ failWith: new Error("edge unavailable") });

		expect(cache.purge({ everything: true })).rejects.toThrow("edge unavailable");
		cache.reset();

		expect(cache.purges).toEqual([]);
		await cache.purge({ tags: ["posts"] });
		expect(cache.purgedTags).toEqual(["posts"]);
	});
});
