/**
 * Tests for {@link DocsNav} in a real browser: a long sidebar opens scrolled to the current
 * page, groups fold natively and open around the current page, and the title filter keeps
 * matches with their groups, says when nothing matches, and restores the tree when cleared.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import type { DocsTree } from "../utils/docs-tree.js";

import { DocsNav } from "./docs-nav.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
});

/** Forty pages in one section, then a section with a group, so the current page sits far down. */
const TREE: DocsTree = {
	label: "Documentation",
	sections: [
		{
			title: "Guides",
			items: Array.from({ length: 40 }, (_, index) => ({
				title: `Guide ${index + 1}`,
				href: `/docs/guide-${index + 1}`,
			})),
		},
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

/** The filter labels every filtering test passes. */
const FILTER = { label: "Filter pages", placeholder: "Filter", noResults: "No page matches" };

/** Mounts the nav inside a 240px scrolling column, the way a sticky sidebar holds it. */
function mountNav(props: Partial<DocsNav.Props> = {}) {
	mounted = render(
		<aside id="column" style="block-size: 240px; overflow-y: auto; inline-size: 260px">
			<DocsNav tree={TREE} activePath="/docs/alerts/webhooks" {...props} />
		</aside>,
	);
}

/** Types `value` into the filter field. */
function type(value: string) {
	let input = document.querySelector<HTMLInputElement>("[data-docs-nav] input")!;
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** The titles of the page links a reader can see. */
function visibleTitles(): string[] {
	return [...document.querySelectorAll<HTMLAnchorElement>("[data-docs-nav] nav a")]
		.filter((link) => link.checkVisibility())
		.map((link) => link.textContent!.replace("New", "").trim());
}

describe("DocsNav", () => {
	test("names its landmark from the tree and marks the current page", () => {
		mountNav();
		let nav = document.querySelector('nav[aria-label="Documentation"]')!;
		let current = nav.querySelectorAll('[aria-current="page"]');
		expect(current).toHaveLength(1);
		expect(current[0]!.getAttribute("href")).toBe("/docs/alerts/webhooks");
	});

	test("opens scrolled to the current page", async () => {
		mountNav();
		await new Promise((resolve) => requestAnimationFrame(resolve));
		let column = document.getElementById("column")!;
		let link = document.querySelector('[aria-current="page"]')!.getBoundingClientRect();
		let box = column.getBoundingClientRect();
		expect(column.scrollTop).toBeGreaterThan(0);
		expect(link.top).toBeGreaterThanOrEqual(box.top);
		expect(link.bottom).toBeLessThanOrEqual(box.bottom);
	});

	test("folds groups natively, keeping the current page's group open", () => {
		mountNav({ collapseGroups: true, activePath: "/docs/guide-2" });
		let group = document.querySelector<HTMLDetailsElement>("[data-docs-nav] details")!;
		expect(group.open).toBe(false);
		mounted?.cleanup();
		mountNav({ collapseGroups: true });
		expect(document.querySelector<HTMLDetailsElement>("[data-docs-nav] details")!.open).toBe(true);
	});

	test("draws no field without a filter and shows it once loaded with one", () => {
		mountNav();
		expect(document.querySelector("[data-docs-nav] input")).toBeNull();
		mounted?.cleanup();
		mountNav({ filter: FILTER });
		expect(
			document.querySelector<HTMLInputElement>("[data-docs-nav] input")!.checkVisibility(),
		).toBe(true);
	});

	test("filters by title, keeping a match's group open and hiding empty sections", () => {
		mountNav({ filter: FILTER, collapseGroups: true, activePath: "/docs/guide-1" });
		type("webhook");
		expect(visibleTitles()).toEqual(["Webhooks"]);
		expect(document.querySelector<HTMLDetailsElement>("[data-docs-nav] details")!.open).toBe(true);
		expect(document.querySelector<HTMLElement>("[data-docs-nav-section]")!.hidden).toBe(true);
	});

	test("keeps every page of a group whose own title matches", () => {
		mountNav({ filter: FILTER });
		type("channels");
		expect(visibleTitles()).toEqual(["Email", "Webhooks"]);
	});

	test("says when nothing matches, and restores the tree when cleared", () => {
		mountNav({ filter: FILTER, collapseGroups: true, activePath: "/docs/guide-1" });
		type("zzz");
		let empty = document.querySelector<HTMLElement>("[data-docs-nav-empty]")!;
		expect(empty.hidden).toBe(false);
		expect(empty.textContent).toBe("No page matches");
		type("");
		expect(empty.hidden).toBe(true);
		expect(visibleTitles()).toHaveLength(41);
		expect(document.querySelector<HTMLDetailsElement>("[data-docs-nav] details")!.open).toBe(false);
	});

	test("fits a 320px phone drawer without overflowing", () => {
		mounted = render(
			<div style="inline-size: 288px">
				<DocsNav tree={TREE} activePath="/docs/alerts" filter={FILTER} />
			</div>,
		);
		let root = document.querySelector<HTMLElement>("[data-docs-nav]")!;
		let wide = [...root.querySelectorAll<HTMLElement>("*")]
			.filter(
				(node) => node.getBoundingClientRect().right > root.getBoundingClientRect().right + 0.5,
			)
			.map(
				(node) =>
					`${node.tagName}.${node.dataset.slot ?? ""} ${node.getBoundingClientRect().width}`,
			);
		expect(wide).toEqual([]);
	});
});
