/**
 * How `sdxc scaffold` reads its fields and pluralizes a name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseFields, pluralize } from "./fields.js";

describe("parseFields", () => {
	test("spells each name as a column, a label, a flag and a key, typed string by default", () => {
		let fields = unwrap(parseFields(["title", "publishedOn:date", "view-count:integer"]));

		expect(fields).toEqual([
			{ column: "title", label: "Title", flag: "title", key: "title", type: "string" },
			{
				column: "published_on",
				label: "Published on",
				flag: "published-on",
				key: "publishedOn",
				type: "date",
			},
			{
				column: "view_count",
				label: "View count",
				flag: "view-count",
				key: "viewCount",
				type: "integer",
			},
		]);
	});

	test.each([
		[[], "at least one field"],
		[["title:varchar"], '"varchar" in "title:varchar" is not a field type'],
		[["id"], "id is a column of every scaffolded table"],
		[["created_at:integer"], "created_at is a column of every scaffolded table"],
		[["title", "Title"], "title is listed twice"],
		[["1st"], '"1st" is not a field name'],
		[["a:b:c"], '"a:b:c" is not a field'],
	])("refuses %j", (specs, message) => {
		let parsed = parseFields(specs);

		expect(isFailure(parsed) && parsed.error.message).toContain(message);
	});
});

describe("pluralize", () => {
	test.each([
		["post", "posts"],
		["blog-post", "blog-posts"],
		["box", "boxes"],
		["match", "matches"],
		["category", "categories"],
		["day", "days"],
	])("%s becomes %s", (singular, plural) => {
		expect(pluralize(singular)).toBe(plural);
	});
});
