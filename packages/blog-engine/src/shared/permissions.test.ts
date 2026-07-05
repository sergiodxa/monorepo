import { describe, expect, test } from "bun:test";

import { hasAll, hasAny, parsePermissions, PERMISSION_KEYS } from "./permissions";

describe("parsePermissions", () => {
	test("keeps catalog keys and drops unknown ones", () => {
		let set = parsePermissions('["posts.create","posts.publish","made.up"]');
		expect(set.has("posts.create")).toBe(true);
		expect(set.has("posts.publish")).toBe(true);
		expect(set.size).toBe(2);
	});

	test("returns empty on malformed JSON", () => {
		expect(parsePermissions("not json").size).toBe(0);
		expect(parsePermissions('"a string"').size).toBe(0);
	});
});

describe("hasAll / hasAny", () => {
	let granted = new Set(["posts.create", "posts.edit_own"] as const);

	test("hasAll requires every key", () => {
		expect(hasAll(granted, ["posts.create"])).toBe(true);
		expect(hasAll(granted, ["posts.create", "posts.edit_own"])).toBe(true);
		expect(hasAll(granted, ["posts.create", "posts.publish"])).toBe(false);
	});

	test("hasAny requires at least one key", () => {
		expect(hasAny(granted, ["posts.publish", "posts.edit_own"])).toBe(true);
		expect(hasAny(granted, ["posts.publish"])).toBe(false);
	});
});

test("the catalog has the eleven documented permissions", () => {
	expect(PERMISSION_KEYS).toHaveLength(11);
});
