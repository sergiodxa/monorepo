/**
 * Tests for the post kind registry: the names `kind:` reads, the stored type each kind maps
 * to, the topics the public post page answers under, and what each kind federates as, so the
 * readers that moved onto the registry keep the values they had.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	isPublicTypePath,
	KINDS,
	kindNamed,
	kindOfType,
	objectTypeAt,
	POST_KINDS,
	PUBLIC_POST_TYPES,
	PUBLIC_TYPE_PATHS,
	publicTypePathOf,
} from "~/app/models/kinds";

describe("the post kind registry", () => {
	test("lists the kinds in the order search tabs show them", () => {
		expect(KINDS).toEqual(["article", "tutorial", "glossary", "bookmark"]);
	});

	test.each([
		["article", "article"],
		["Articles", "article"],
		["tutorials", "tutorial"],
		["glossaries", "glossary"],
		[" bookmarks ", "bookmark"],
		["like", "bookmark"],
		["LIKES", "bookmark"],
		["comment", null],
		["", null],
	] as const)("reads kind:%s as %s", (name, kind) => {
		expect(kindNamed(name)).toBe(kind);
	});

	test("maps each stored type to its kind, a bookmark being a like", () => {
		expect(kindOfType("like")).toBe("bookmark");
		expect(kindOfType("glossary")).toBe("glossary");
		expect(kindOfType("comment")).toBeNull();
	});

	test("serves only articles and tutorials on the public post page", () => {
		expect(PUBLIC_TYPE_PATHS).toEqual(["articles", "tutorials"]);
		expect(PUBLIC_POST_TYPES).toEqual(["article", "tutorial"]);
		expect(isPublicTypePath("tutorials")).toBe(true);
		expect(isPublicTypePath("glossary")).toBe(false);
		expect(isPublicTypePath(undefined)).toBe(false);
		expect(publicTypePathOf("article")).toBe("articles");
		expect(publicTypePathOf("like")).toBeNull();
	});

	test("federates the public post page's kinds as Article", () => {
		expect(objectTypeAt("articles")).toBe("Article");
		expect(objectTypeAt("tutorials")).toBe("Article");
	});

	test("gives every kind a distinct topic and emoji", () => {
		let entries = KINDS.map((kind) => POST_KINDS[kind]);
		expect(new Set(entries.map((entry) => entry.topic)).size).toBe(KINDS.length);
		expect(new Set(entries.map((entry) => entry.icon)).size).toBe(KINDS.length);
	});

	test("lets no name stand for two kinds", () => {
		let names = KINDS.flatMap((kind) => POST_KINDS[kind].names);
		expect(new Set(names).size).toBe(names.length);
	});
});
