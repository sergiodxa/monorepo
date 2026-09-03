/**
 * Tests element traversal, path normalization, and path-based querying
 * against a small XML tree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	collectInElement,
	findInElement,
	normalizePath,
	queryFromElements,
	startsWithRoot,
} from "./traversal.js";

let tree = {
	name: "rss",
	attributes: { version: "2.0" },
	children: [
		{
			name: "channel",
			attributes: {},
			children: [
				{ name: "title", attributes: {}, children: ["Feed"] },
				{
					name: "item",
					attributes: {},
					children: [{ name: "title", attributes: {}, children: ["One"] }],
				},
				{
					name: "item",
					attributes: {},
					children: [{ name: "title", attributes: {}, children: ["Two"] }],
				},
			],
		},
	],
};

describe("traversal helpers", () => {
	test("findInElement returns the first depth-first match as a clone", () => {
		let match = findInElement(tree, (element) => element.name === "item");

		expect(match).toEqual({
			name: "item",
			attributes: {},
			children: [{ name: "title", attributes: {}, children: ["One"] }],
		});
		expect(match).not.toBe(
			tree.children?.[0] && typeof tree.children[0] !== "string" ? tree.children[0] : undefined,
		);
	});

	test("collectInElement appends all matches as clones", () => {
		let matches: Array<
			(typeof tree)["children"] extends Array<infer T> ? Exclude<T, string> : never
		> = [];

		collectInElement(tree, (element) => element.name === "item", matches);

		expect(matches).toHaveLength(2);
		expect(matches[0]).toEqual({
			name: "item",
			attributes: {},
			children: [{ name: "title", attributes: {}, children: ["One"] }],
		});
		expect(matches[0]).not.toBe(matches[1]);
	});

	test("normalizePath trims and removes empty segments", () => {
		expect(normalizePath(" /rss/ channel /item//title/ ")).toEqual([
			"rss",
			"channel",
			"item",
			"title",
		]);
	});

	test("startsWithRoot checks the first segment", () => {
		expect(startsWithRoot(["rss", "channel"], "rss")).toBe(true);
		expect(startsWithRoot(["channel", "item"], "rss")).toBe(false);
	});

	test("queryFromElements resolves exact child-name paths", () => {
		expect(queryFromElements([tree], ["channel", "item"])).toEqual([
			{
				name: "item",
				attributes: {},
				children: [{ name: "title", attributes: {}, children: ["One"] }],
			},
			{
				name: "item",
				attributes: {},
				children: [{ name: "title", attributes: {}, children: ["Two"] }],
			},
		]);
	});
});
