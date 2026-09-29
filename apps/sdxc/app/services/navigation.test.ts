/**
 * Tests for the documentation's sidebars. Each part of the site draws its own tree and
 * the pager reads that same tree, so these assertions are what keep a reader stepping
 * forward inside the part they are reading rather than being carried into another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	buildComponentsNav,
	buildGuidesNav,
	buildPackageNav,
	buildPackagesNav,
	buildUtilitiesNav,
	findNeighbours,
	flattenNav,
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
			expect(entry.title).toMatch(/^@sdxc\//);
			expect(entry.href).toBe(`/api/${entry.title.slice("@sdxc/".length)}`);
		}

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

		expect(flat.slice(0, 2)).toEqual([
			{ title: "Overview", href: "/api/ui" },
			{ title: "Theming", href: "/api/ui/theming" },
		]);
		expect(flat.length).toBeGreaterThan(2);
		for (let entry of flat.slice(1)) expect(entry.href).toMatch(/^\/api\/ui\//);
	});
});

describe("buildPackageNav", () => {
	test("gives each catalogue its own tree, and every other package the package tree", async () => {
		expect((await buildPackageNav("u")).label).toBe("@sdxc/u");
		expect((await buildPackageNav("ui")).label).toBe("@sdxc/ui");
		expect((await buildPackageNav("result")).label).toBe("API");
	});
});

describe("findNeighbours", () => {
	test("leaves the first page without a previous and the last without a next", async () => {
		let tree = await buildGuidesNav();
		let flat = flattenNav(tree);
		let first = flat.at(0);
		let last = flat.at(-1);

		expect(first).toBeDefined();
		expect(last).toBeDefined();

		expect(findNeighbours(tree, first?.href ?? "")).toEqual({
			previous: null,
			next: flat.at(1),
		});
		expect(findNeighbours(tree, last?.href ?? "")).toEqual({
			previous: flat.at(-2),
			next: null,
		});
	});

	test("ends the guides at their last page rather than stepping into the packages", async () => {
		let tree = await buildGuidesNav();
		let last = flattenNav(tree).at(-1);

		expect(findNeighbours(tree, last?.href ?? "").next).toBeNull();
	});

	test("steps across a section boundary inside one tree", async () => {
		let tree = await buildPackagesNav();
		let second = tree.sections.at(1)?.entries.at(0);

		expect(findNeighbours(tree, "/api").next).toEqual(second);
	});

	test("reports neither neighbour for a path the tree has no entry for", async () => {
		let tree = await buildGuidesNav();

		expect(findNeighbours(tree, "/docs")).toEqual({ previous: null, next: null });
		expect(findNeighbours(tree, "/api")).toEqual({ previous: null, next: null });
	});
});
