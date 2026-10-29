/**
 * Tests for the search frame's query string: a known kind narrows the tab, and any other
 * value fails, which the frame reads as the "All" tab.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { describe, expect, test } from "vitest";

import { SearchFrameQuerySchema } from "~/app/http/validators/search";

describe("SearchFrameQuerySchema", () => {
	test("accepts a kind the search reaches", async () => {
		let result = await validate(new URLSearchParams({ kind: "u" }), SearchFrameQuerySchema);

		expect(isSuccess(result) ? result.data.kind : null).toBe("u");
	});

	test("accepts no kind at all", async () => {
		expect(isSuccess(await validate(new URLSearchParams(), SearchFrameQuerySchema))).toBe(true);
	});

	test("refuses a kind the search does not reach", async () => {
		let result = await validate(new URLSearchParams({ kind: "posts" }), SearchFrameQuerySchema);

		expect(isFailure(result)).toBe(true);
	});
});
