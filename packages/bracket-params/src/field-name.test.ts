/**
 * Tests for `fieldName`: the names it writes, and that `parse` reads each name back into the
 * path it came from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { fieldName, parse } from "./index.js";

describe("fieldName", () => {
	test("writes the root bare and later segments in brackets", () => {
		expect(fieldName(["title"])).toBe("title");
		expect(fieldName(["items", 0, "quantity"])).toBe("items[0][quantity]");
		expect(fieldName([])).toBe("");
	});

	test("reads segments in a schema issue's object form", () => {
		expect(fieldName([{ key: "items" }, { key: 1 }])).toBe("items[1]");
	});

	test("names the input a schema issue belongs to", () => {
		let schema = s.object({ items: s.array(s.object({ quantity: s.number() })) });
		let result = parse("items[0][quantity]=two", schema);
		if (!isFailure(result)) throw new Error("Expected a failure");
		expect(result.error.issues.map((issue) => fieldName(issue.path ?? []))).toEqual([
			"items[0][quantity]",
		]);
	});
});
