/**
 * Tests for the snapshot parser: that a stored `state()` reads back into a
 * stream that resumes, and that a snapshot with a malformed seed or word is
 * reported instead of resuming a different sequence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { RANDOM_STATE_SCHEMA } from "./schema.js";
import { createRandom, restoreRandom } from "./seeded.js";

describe("RANDOM_STATE_SCHEMA", () => {
	test("reads back a stored snapshot that resumes the stream", () => {
		let original = createRandom("stored");
		original.next();
		let parsed = s.parseSafe(RANDOM_STATE_SCHEMA, JSON.parse(JSON.stringify(original.state())));

		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(restoreRandom(parsed.value).next()).toBe(original.next());
	});

	test.each([
		["a missing seed", { words: [1, 2, 3, 4] }],
		["a seed of the wrong type", { seed: true, words: [1, 2, 3, 4] }],
		["too few words", { seed: "x", words: [1, 2, 3] }],
		["a negative word", { seed: "x", words: [1, 2, 3, -4] }],
		["a fractional word", { seed: "x", words: [1, 2, 3, 4.5] }],
		["a word past 32 bits", { seed: "x", words: [1, 2, 3, 2 ** 32] }],
	])("rejects %s", (_, value) => {
		expect(s.parseSafe(RANDOM_STATE_SCHEMA, value).success).toBe(false);
	});
});
