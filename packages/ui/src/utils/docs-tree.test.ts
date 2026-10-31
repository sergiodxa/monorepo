/**
 * Unit tests for the docs tree helpers: reading order with groups inline, neighbours at
 * both ends and outside the tree, and the section boundary keeping the pager in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { DocsTree } from "./docs-tree.js";

import { findNeighbours, flattenDocsTree } from "./docs-tree.js";

const TREE: DocsTree = {
	label: "Docs",
	sections: [
		{
			title: "Start",
			items: [
				{ title: "Introduction", href: "/docs" },
				{ title: "Install", href: "/docs/install" },
			],
		},
		{
			title: "Guides",
			items: [
				{
					title: "Monitors",
					href: "/docs/monitors",
					items: [
						{ title: "HTTP checks", href: "/docs/monitors/http" },
						{ title: "Nested", items: [{ title: "Keywords", href: "/docs/monitors/keywords" }] },
					],
				},
				{ title: "Alerts", href: "/docs/alerts", badge: "New" },
			],
		},
	],
};

describe("flattenDocsTree", () => {
	test("lists pages in sidebar order, a group's own page before its children", () => {
		expect(flattenDocsTree(TREE).map((page) => page.href)).toEqual([
			"/docs",
			"/docs/install",
			"/docs/monitors",
			"/docs/monitors/http",
			"/docs/monitors/keywords",
			"/docs/alerts",
		]);
	});

	test("labels every page with its section's title", () => {
		expect(flattenDocsTree(TREE)[4]).toEqual({
			title: "Keywords",
			href: "/docs/monitors/keywords",
			section: "Guides",
		});
	});
});

describe("findNeighbours", () => {
	test("crosses sections by default", () => {
		let { previous, next } = findNeighbours(TREE, "/docs/install");
		expect(previous?.href).toBe("/docs");
		expect(next).toEqual({ title: "Monitors", href: "/docs/monitors", section: "Guides" });
	});

	test("stops at the section edge with boundary section", () => {
		let { previous, next } = findNeighbours(TREE, "/docs/install", { boundary: "section" });
		expect(previous?.href).toBe("/docs");
		expect(next).toBeNull();
		expect(findNeighbours(TREE, "/docs/monitors", { boundary: "section" }).previous).toBeNull();
	});

	test("leaves the ends of the run empty", () => {
		expect(findNeighbours(TREE, "/docs").previous).toBeNull();
		expect(findNeighbours(TREE, "/docs/alerts").next).toBeNull();
	});

	test("reports neither neighbour for a path outside the tree", () => {
		expect(findNeighbours(TREE, "/docs/missing")).toEqual({ previous: null, next: null });
	});
});
