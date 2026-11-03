/**
 * Tests for the docs sidebar's title matcher, which decides the pages a server-filtered tree
 * keeps; the browser's filter runs the same matcher, so these cover both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { DocsTree } from "./docs-tree.js";

import { matchDocsTree } from "./docs-filter.js";

/** A page, a group of two with a badge on one, and an accented title. */
const TREE: DocsTree = {
	label: "Documentation",
	sections: [
		{ title: "Guides", items: [{ title: "Configuración", href: "/docs/config" }] },
		{
			title: "Alerts",
			items: [
				{ title: "Overview", href: "/docs/alerts" },
				{
					title: "Channels",
					items: [
						{ title: "Email", href: "/docs/alerts/email" },
						{ title: "Webhooks", href: "/docs/alerts/webhooks", badge: "New" },
					],
				},
			],
		},
	],
};

/** The titles `query` keeps shown. */
function shownTitles(query: string): string[] {
	return [...(matchDocsTree(TREE, query)?.shown ?? [])].map((item) => item.title);
}

describe("matchDocsTree", () => {
	test("keeps the whole tree for a query with no words", () => {
		expect(matchDocsTree(TREE, "  ")).toBeNull();
	});

	test("keeps a match with the group around it, opening that group", () => {
		let matches = matchDocsTree(TREE, "web HOOK")!;
		expect(shownTitles("web HOOK")).toEqual(["Webhooks", "Channels"]);
		expect([...matches.opened].map((item) => item.title)).toEqual(["Channels"]);
	});

	test("keeps every page of a group whose own title matches", () => {
		expect(shownTitles("channels")).toEqual(["Email", "Webhooks", "Channels"]);
	});

	test("matches titles alone, ignoring case, accents and badges", () => {
		expect(shownTitles("configuracion")).toEqual(["Configuración"]);
		expect(shownTitles("new")).toEqual([]);
	});
});
