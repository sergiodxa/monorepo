/**
 * Specifies the layered layout and its nested-group wrapper: ranks follow the
 * edges, neighbors never overlap, cycles and self-loops still route, labels
 * get room, and groups enclose their members.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Box } from "./geometry.js";
import type { GraphNode } from "./layered.js";

import { layoutCompound } from "./compound.js";
import { layoutGraph } from "./layered.js";

/**
 * @param ids - Node ids
 * @returns A 60×30 node for each
 */
function nodes(...ids: string[]): GraphNode[] {
	return ids.map((id) => ({ id, width: 60, height: 30 }));
}

/**
 * @param map - Placed boxes
 * @param id - The one to read
 * @returns Its box
 */
function box(map: Map<string, Box>, id: string): Box {
	let found = map.get(id);
	if (!found) throw new Error(`No box for ${id}`);
	return found;
}

/**
 * @param a - One box
 * @param b - Another
 * @returns Whether they share any area
 */
function overlaps(a: Box, b: Box): boolean {
	return (
		Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2
	);
}

describe("layoutGraph", () => {
	test("ranks each target below its source when flowing top to bottom", () => {
		let layout = layoutGraph(
			nodes("a", "b", "c"),
			[
				{ from: "a", to: "b" },
				{ from: "b", to: "c" },
			],
			{ direction: "TB" },
		);

		expect(box(layout.nodes, "a").y).toBeLessThan(box(layout.nodes, "b").y);
		expect(box(layout.nodes, "b").y).toBeLessThan(box(layout.nodes, "c").y);
	});

	test("turns the flow for each direction", () => {
		let edges = [{ from: "a", to: "b" }];
		let at = (direction: "TB" | "BT" | "LR" | "RL") => {
			let layout = layoutGraph(nodes("a", "b"), edges, { direction });
			return { a: box(layout.nodes, "a"), b: box(layout.nodes, "b") };
		};

		expect(at("BT").a.y).toBeGreaterThan(at("BT").b.y);
		expect(at("LR").a.x).toBeLessThan(at("LR").b.x);
		expect(at("RL").a.x).toBeGreaterThan(at("RL").b.x);
		expect(at("LR").a.y).toBe(at("LR").b.y);
	});

	test("keeps nodes in one rank apart", () => {
		let layout = layoutGraph(
			nodes("root", "a", "b", "c", "d"),
			[
				{ from: "root", to: "a" },
				{ from: "root", to: "b" },
				{ from: "root", to: "c" },
				{ from: "root", to: "d" },
			],
			{ direction: "TB" },
		);
		let placed = [...layout.nodes.values()];

		for (let [index, first] of placed.entries()) {
			for (let second of placed.slice(index + 1)) expect(overlaps(first, second)).toBe(false);
		}
	});

	test("lays out a cycle with the first node on top", () => {
		let layout = layoutGraph(
			nodes("a", "b", "c"),
			[
				{ from: "a", to: "b" },
				{ from: "b", to: "c" },
				{ from: "c", to: "a" },
			],
			{ direction: "TB" },
		);

		expect(box(layout.nodes, "a").y).toBeLessThan(box(layout.nodes, "c").y);
		let back = layout.edges[2];
		expect(back?.points[0]).toMatchObject({
			x: box(layout.nodes, "c").x,
			y: box(layout.nodes, "c").y,
		});
		expect(back?.points.at(-1)).toMatchObject({
			x: box(layout.nodes, "a").x,
			y: box(layout.nodes, "a").y,
		});
	});

	test("routes edges from center to center, in the order they were given", () => {
		let layout = layoutGraph(
			nodes("a", "b"),
			[
				{ from: "b", to: "a" },
				{ from: "a", to: "b" },
			],
			{ direction: "TB" },
		);
		let a = box(layout.nodes, "a");
		let b = box(layout.nodes, "b");

		expect(layout.edges[0]?.points[0]).toMatchObject({ x: b.x, y: b.y });
		expect(layout.edges[1]?.points[0]).toMatchObject({ x: a.x, y: a.y });
	});

	test("leaves room along the flow for a label, and places it between the ends", () => {
		let plain = layoutGraph(nodes("a", "b"), [{ from: "a", to: "b" }], { direction: "TB" });
		let labelled = layoutGraph(
			nodes("a", "b"),
			[{ from: "a", to: "b", label: { width: 80, height: 40 } }],
			{
				direction: "TB",
			},
		);
		let label = labelled.edges[0]?.label;

		expect(labelled.height).toBeGreaterThanOrEqual(plain.height + 40);
		expect(label?.y).toBeGreaterThan(box(labelled.nodes, "a").y);
		expect(label?.y).toBeLessThan(box(labelled.nodes, "b").y);
	});

	test("spans more ranks for a longer edge", () => {
		let layout = layoutGraph(
			nodes("a", "b", "c"),
			[
				{ from: "a", to: "b" },
				{ from: "a", to: "c", length: 2 },
			],
			{ direction: "TB" },
		);

		expect(box(layout.nodes, "c").y).toBeGreaterThan(box(layout.nodes, "b").y);
	});

	test("routes a self-loop out of the node's side and counts it in the size", () => {
		let layout = layoutGraph(nodes("a"), [{ from: "a", to: "a" }], { direction: "TB" });
		let a = box(layout.nodes, "a");

		expect(layout.edges[0]?.points.length).toBe(4);
		expect(Math.max(...(layout.edges[0]?.points ?? []).map((point) => point.x))).toBeGreaterThan(
			a.x + a.width / 2,
		);
		expect(layout.width).toBeGreaterThan(a.width);
	});

	test("starts the drawing at the origin", () => {
		let layout = layoutGraph(nodes("a", "b"), [{ from: "a", to: "b" }], { direction: "RL" });
		let left = Math.min(...[...layout.nodes.values()].map((placed) => placed.x - placed.width / 2));
		let top = Math.min(...[...layout.nodes.values()].map((placed) => placed.y - placed.height / 2));

		expect(left).toBe(0);
		expect(top).toBe(0);
	});
});

describe("layoutCompound", () => {
	test("encloses each group's members, below its header", () => {
		let layout = layoutCompound({
			direction: "TB",
			nodes: [
				{ id: "out", width: 60, height: 30 },
				{ id: "in1", width: 60, height: 30, parent: "g" },
				{ id: "in2", width: 60, height: 30, parent: "inner" },
			],
			groups: [
				{ id: "g", header: { width: 40, height: 20 } },
				{ id: "inner", parent: "g", header: { width: 40, height: 20 } },
			],
			edges: [
				{ from: "out", to: "in1" },
				{ from: "in1", to: "in2" },
			],
		});
		let group = box(layout.groups, "g");
		let inner = box(layout.groups, "inner");
		let contains = (outer: Box, item: Box): boolean =>
			item.x - item.width / 2 >= outer.x - outer.width / 2 &&
			item.x + item.width / 2 <= outer.x + outer.width / 2 &&
			item.y - item.height / 2 >= outer.y - outer.height / 2 + 20 &&
			item.y + item.height / 2 <= outer.y + outer.height / 2;

		expect(contains(group, box(layout.nodes, "in1"))).toBe(true);
		expect(contains(group, inner)).toBe(true);
		expect(contains(inner, box(layout.nodes, "in2"))).toBe(true);
		expect(overlaps(group, box(layout.nodes, "out"))).toBe(false);
	});

	test("ends a route that enters a group on the node it names", () => {
		let layout = layoutCompound({
			direction: "TB",
			nodes: [
				{ id: "out", width: 60, height: 30 },
				{ id: "in", width: 60, height: 30, parent: "g" },
			],
			groups: [{ id: "g", header: { width: 40, height: 20 } }],
			edges: [{ from: "out", to: "in" }],
		});
		let target = box(layout.nodes, "in");

		expect(layout.edges[0]?.points.at(-1)).toEqual({ x: target.x, y: target.y });
	});

	test("lays a group out in its own direction", () => {
		let layout = layoutCompound({
			direction: "TB",
			nodes: [
				{ id: "a", width: 60, height: 30, parent: "g" },
				{ id: "b", width: 60, height: 30, parent: "g" },
			],
			groups: [{ id: "g", direction: "LR", header: { width: 40, height: 20 } }],
			edges: [{ from: "a", to: "b" }],
		});

		expect(box(layout.nodes, "a").y).toBe(box(layout.nodes, "b").y);
		expect(box(layout.nodes, "a").x).toBeLessThan(box(layout.nodes, "b").x);
	});
});
