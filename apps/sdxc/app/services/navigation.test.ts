/**
 * Tests for the documentation's single ordering. The sidebar and the pager read the
 * same tree, so these assertions are what keep a reader stepping forward from landing
 * somewhere other than the link drawn below the one they came from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { NavTree } from "~/app/services/navigation";

import { buildNavTree, findNeighbours, flattenNav } from "~/app/services/navigation";

/** How many entries the guides contribute, which is where the packages start. */
function countGuides(tree: NavTree): number {
	return tree.guides.reduce((total, group) => total + group.entries.length, 0);
}

/** How many entries the packages contribute, which is where the catalogues start. */
function countPackages(tree: NavTree): number {
	return tree.packages.reduce((total, group) => total + group.entries.length, 0);
}

describe("flattenNav", () => {
	test("reads every guide group before every package group", async () => {
		let tree = await buildNavTree();
		let flat = flattenNav(tree);
		let guideCount = countGuides(tree);
		let packageCount = countPackages(tree);

		expect(tree.guides.length).toBeGreaterThan(0);
		expect(tree.packages.length).toBeGreaterThan(0);

		expect(flat.slice(0, guideCount)).toEqual(tree.guides.flatMap((group) => group.entries));
		expect(flat.slice(guideCount, guideCount + packageCount)).toEqual(
			tree.packages.flatMap((group) => group.entries),
		);
	});

	test("reads both catalogues after the packages, so the pager runs to the end of the tree", async () => {
		let tree = await buildNavTree();
		let flat = flattenNav(tree);
		let catalogues = [...tree.utilities.flatMap((group) => group.entries), ...tree.components];

		expect(tree.utilities.length).toBe(13);
		expect(tree.components.length).toBeGreaterThan(0);
		expect(flat.slice(-catalogues.length)).toEqual(catalogues);
	});

	test("keeps each group's own order, and titles packages as they are installed", async () => {
		let tree = await buildNavTree();
		let flat = flattenNav(tree);

		expect(flat.at(0)).toEqual(tree.guides.at(0)?.entries.at(0));
		expect(flat.at(-1)).toEqual(tree.components.at(-1));

		for (let group of tree.packages) {
			for (let entry of group.entries) {
				expect(entry.title).toMatch(/^@sdxc\//);
				expect(entry.href).toBe(`/docs/packages/${entry.title.slice("@sdxc/".length)}`);
			}
		}
	});
});

describe("findNeighbours", () => {
	test("leaves the first page without a previous and the last without a next", async () => {
		let tree = await buildNavTree();
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

	test("steps from the last guide into the first package", async () => {
		let tree = await buildNavTree();
		let flat = flattenNav(tree);
		let guideCount = countGuides(tree);
		let lastGuide = flat.at(guideCount - 1);

		expect(lastGuide).toBeDefined();
		expect(findNeighbours(tree, lastGuide?.href ?? "").next).toEqual(flat.at(guideCount));
	});

	test("reports neither neighbour for a path the tree has no entry for", async () => {
		let tree = await buildNavTree();

		expect(findNeighbours(tree, "/docs")).toEqual({ previous: null, next: null });
		expect(findNeighbours(tree, "/docs/packages")).toEqual({ previous: null, next: null });
	});
});
