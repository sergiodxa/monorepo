/**
 * Tests for the documentation's sidebars. Each part of the site draws its own tree and
 * the pager reads that same tree, so these assertions are what keep a reader stepping
 * forward inside the part they are reading rather than being carried into another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { findNeighbours } from "@sdxc/ui/docs";
import { describe, expect, test } from "vitest";

import {
	buildComponentsNav,
	buildGuidesNav,
	buildPackageNav,
	buildPackagesNav,
	buildUtilitiesNav,
	flattenNav,
	toDocsTree,
} from "~/app/services/navigation";

describe("buildGuidesNav", () => {
	test("holds the guides and nothing from the package reference", async () => {
		let flat = flattenNav(await buildGuidesNav());

		expect(flat.length).toBeGreaterThan(0);
		for (let entry of flat) expect(entry.href).toMatch(/^\/docs\//);
	});
});

describe("buildPackagesNav", () => {
	test("lists every package but the two catalogues, titled as they are installed", async () => {
		let tree = await buildPackagesNav();
		let [index, ...groups] = tree.sections;
		let entries = groups.flatMap((section) => section.entries);

		expect(index?.entries).toEqual([{ title: "Every package", href: "/api" }]);
		expect(entries.length).toBeGreaterThan(0);

		for (let entry of entries) {
			expect(entry.title).toMatch(/^@sdxc\/[a-z0-9-]+$/);
			expect(entry.href).toBe(`/api/${entry.title.replace(/^@sdxc\//, "")}`);
		}
		expect(entries).not.toContainEqual({ title: "sdxc", href: "/api/sdxc" });

		let titles = entries.map((entry) => entry.title);
		expect(titles).not.toContain("@sdxc/u");
		expect(titles).not.toContain("@sdxc/ui");
	});
});

describe("buildUtilitiesNav", () => {
	test("holds only @sdxc/u, its utilities under their thirteen families", async () => {
		let tree = await buildUtilitiesNav();
		let flat = flattenNav(tree);

		expect(tree.sections.flatMap((section) => section.groups)).toHaveLength(13);
		expect(flat.at(0)).toEqual({ title: "Overview", href: "/api/u" });
		for (let entry of flat.slice(1)) expect(entry.href).toMatch(/^\/api\/u\//);
	});
});

describe("buildComponentsNav", () => {
	test("holds only @sdxc/ui, with theming ahead of the components", async () => {
		let flat = flattenNav(await buildComponentsNav());

		expect(flat.slice(0, 8)).toEqual([
			{ title: "Overview", href: "/api/ui" },
			{ title: "Theming", href: "/api/ui/theming" },
			{ title: "Landing foundations", href: "/api/ui/landing-foundations" },
			{ title: "Landing components", href: "/api/ui/landing-components" },
			{ title: "Landing patterns", href: "/api/ui/landing-patterns" },
			{ title: "Docs foundations", href: "/api/ui/docs-foundations" },
			{ title: "Docs components", href: "/api/ui/docs-components" },
			{ title: "Docs patterns", href: "/api/ui/docs-patterns" },
		]);
		expect(flat.length).toBeGreaterThan(8);
		for (let entry of flat.slice(1)) expect(entry.href).toMatch(/^\/api\/ui\//);
	});

	test("follows the components with each subpath they are built from", async () => {
		let tree = await buildComponentsNav();

		expect(tree.sections.map((section) => section.title)).toEqual([
			"@sdxc/ui",
			"Components",
			"Landing",
			"Docs",
			"Chat",
			"Color",
			"App",
			"Mixins",
			"Behaviors",
			"Animations",
			"Styles",
		]);
		expect(tree.sections.at(7)?.entries).toContainEqual({
			title: "hotkey",
			href: "/api/ui/mixins/hotkey",
		});
	});
});

describe("namespace groups", () => {
	test("lists each namespace's components apart from the general ones", async () => {
		let tree = await buildComponentsNav();
		let titles = (section: string) =>
			tree.sections.find((entry) => entry.title === section)?.entries.map((entry) => entry.title) ??
			[];

		expect(titles("Landing")).toEqual(
			expect.arrayContaining(["LandingHero", "FlowDiagram", "LandingSection", "SiteHeader"]),
		);
		expect(titles("Docs")).toEqual(
			expect.arrayContaining(["DocsLayout", "DocsNav", "TableOfContents", "CodeBlock", "Callout"]),
		);
		expect(titles("Chat")).toEqual(expect.arrayContaining(["Message", "MessageScroller"]));
		expect(titles("Color")).toEqual(expect.arrayContaining(["ColorPicker", "ColorWheel"]));
		expect(titles("App")).toEqual(expect.arrayContaining(["Chart", "Table", "Toast"]));
		expect(
			["Landing", "Docs", "Chat", "Color", "App"].map((section) => titles(section).length),
		).toEqual([42, 24, 5, 7, 15]);
		expect(titles("Components")).toEqual(
			expect.arrayContaining(["Accordion", "CtaGroup", "DialogDismiss", "Sidebar"]),
		);
		expect(titles("Components")).not.toContain("LandingSection");
		expect(titles("Components")).not.toContain("Callout");
	});
});

describe("buildPackageNav", () => {
	test("gives each catalogue its own tree, and every other package the package tree", async () => {
		expect((await buildPackageNav("u")).label).toBe("@sdxc/u");
		expect((await buildPackageNav("ui")).label).toBe("@sdxc/ui");
		expect((await buildPackageNav("result")).label).toBe("API");
	});
});

describe("toDocsTree", () => {
	test("keeps every entry in the order the sidebar draws it", async () => {
		let tree = await buildComponentsNav();
		let pages = findOrder(toDocsTree(tree));

		expect(pages).toEqual(flattenNav(tree).map((entry) => entry.href));
	});
});

describe("findNeighbours over a converted tree", () => {
	test("leaves the first page without a previous and the last without a next", async () => {
		let tree = await buildGuidesNav();
		let flat = flattenNav(tree);

		expect(findNeighbours(toDocsTree(tree), flat.at(0)?.href ?? "").previous).toBeNull();
		expect(findNeighbours(toDocsTree(tree), flat.at(-1)?.href ?? "").next).toBeNull();
	});

	test("keeps the pager inside the section being read", async () => {
		let tree = await buildGuidesNav();
		let section = tree.sections.find((candidate) => candidate.entries.length > 1);
		let last = section?.entries.at(-1);

		expect(last).toBeDefined();
		let { next, previous } = findNeighbours(toDocsTree(tree), last?.href ?? "", {
			boundary: "section",
		});
		expect(previous?.section).toBe(section?.title);
		expect(next === null || next.section === section?.title).toBe(true);
	});

	test("reports neither neighbour for a path the tree has no entry for", async () => {
		let tree = toDocsTree(await buildGuidesNav());

		expect(findNeighbours(tree, "/docs")).toEqual({ previous: null, next: null });
	});
});

/** Every page href in a converted tree, depth first, which is the order the pager reads. */
function findOrder(tree: ReturnType<typeof toDocsTree>): string[] {
	return tree.sections.flatMap((section) =>
		section.items.flatMap((item) => [
			...(item.href ? [item.href] : []),
			...(item.items ?? []).flatMap((child) => (child.href ? [child.href] : [])),
		]),
	);
}
