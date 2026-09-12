/**
 * Checks the doubly linked list the delimiter algorithm splices into, one
 * structural operation at a time. Every case reads the list back from both ends,
 * since a `next` and a `previous` that disagree would surface far downstream, as
 * a mangled document rather than as a broken link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Markdown } from "../../index.js";

import type { Cell } from "./cells.js";

import { Cells } from "./cells.js";

/** The span every stand-in node carries, since these cases read the list's shape rather than its positions. */
const POSITION: Markdown.Position = {
	start: { line: 1, column: 1, offset: 0 },
	end: { line: 1, column: 1, offset: 0 },
};

/**
 * @param value - The text the node holds, which is how a case names it
 * @returns A node standing in for whatever the inline phase wrote
 */
function text(value: string): Markdown.Text {
	return { type: "text", value, position: POSITION };
}

/**
 * @param children - The nodes the span claims
 * @returns A parent standing in for the span an emphasis pair produces
 */
function emphasis(children: Markdown.Inline[]): Markdown.Emphasis {
	return { type: "emphasis", children, position: POSITION };
}

/**
 * @param node - The node to name
 * @returns The text a node holds, with a parent written as its children in parentheses
 */
function label(node: Markdown.Inline): string {
	if (node.type === "text") return node.value;
	if (node.type === "emphasis") return `(${node.children.map(label).join("")})`;

	return node.type;
}

/**
 * Walks the list from its tail, which is the only way a case reaches every
 * `previous` link the forward walk never reads.
 *
 * @param cells - The list to walk
 * @returns Every cell in source order
 */
function backwards(cells: Cells): Cell[] {
	let walked: Cell[] = [];

	for (let cursor = cells.last; cursor; cursor = cursor.previous) walked.unshift(cursor);

	return walked;
}

/**
 * @param cells - The list to check
 * @param expected - The nodes the list should hold, named the way {@link label} names them
 */
function expectList(cells: Cells, expected: string[]): void {
	let walked = backwards(cells);

	expect(cells.toArray().map(label)).toEqual(expected);
	expect(walked.map((cell) => label(cell.node))).toEqual(expected);

	for (let [index, cell] of walked.entries()) {
		expect(cell.previous).toBe(walked[index - 1] ?? null);
		expect(cell.next).toBe(walked[index + 1] ?? null);
	}

	expect(cells.last).toBe(walked.at(-1) ?? null);
}

describe("appending", () => {
	test("writes nodes in the order they arrive", () => {
		let cells = new Cells();

		cells.append(text("a"), 0, 1);
		cells.append(text("b"), 1, 2);
		cells.append(text("c"), 2, 3);

		expectList(cells, ["a", "b", "c"]);
	});

	test("the newest node is the one the list reports as last", () => {
		let cells = new Cells();

		cells.append(text("a"), 0, 1);

		let second = cells.append(text("b"), 1, 2);

		expect(cells.last).toBe(second);
	});

	test("an empty list holds no nodes and reports no last one", () => {
		let cells = new Cells();

		expectList(cells, []);
		expect(cells.last).toBeNull();
	});

	test("the first node has nothing on either side of it", () => {
		let cells = new Cells();
		let first = cells.append(text("a"), 0, 1);

		expect(first.previous).toBeNull();
		expect(first.next).toBeNull();
	});

	test("the cell carries back the node and the span it was given", () => {
		let cells = new Cells();
		let node = text("abc");
		let cell = cells.append(node, 3, 6);

		expect(cell.node).toBe(node);
		expect(cell.start).toBe(3);
		expect(cell.end).toBe(6);
	});

	test("a node is verbatim only when the caller says it is", () => {
		let cells = new Cells();

		expect(cells.append(text("a"), 0, 1).verbatim).toBe(false);
		expect(cells.append(text("b"), 1, 2, true).verbatim).toBe(true);
	});
});

describe("inserting", () => {
	test("an inserted node lands between the cell it follows and that cell's neighbour", () => {
		let cells = new Cells();
		let first = cells.append(text("a"), 0, 1);

		cells.append(text("c"), 2, 3);
		cells.insertAfter(first, text("b"), 1, 2);

		expectList(cells, ["a", "b", "c"]);
	});

	test("inserting after the last cell makes the new one last", () => {
		let cells = new Cells();
		let first = cells.append(text("a"), 0, 1);
		let inserted = cells.insertAfter(first, text("b"), 1, 2);

		expectList(cells, ["a", "b"]);
		expect(cells.last).toBe(inserted);
	});

	test("the inserted cell carries the span it was given and is never verbatim", () => {
		let cells = new Cells();
		let first = cells.append(text("a"), 0, 1, true);
		let inserted = cells.insertAfter(first, text("b"), 4, 9);

		expect(inserted.start).toBe(4);
		expect(inserted.end).toBe(9);
		expect(inserted.verbatim).toBe(false);
	});
});

describe("removing", () => {
	test("removing from the middle joins the neighbours to each other", () => {
		let cells = new Cells();

		cells.append(text("a"), 0, 1);

		let middle = cells.append(text("b"), 1, 2);

		cells.append(text("c"), 2, 3);
		cells.remove(middle);

		expectList(cells, ["a", "c"]);
	});

	test("removing the first node promotes the one after it to the head", () => {
		let cells = new Cells();
		let first = cells.append(text("a"), 0, 1);

		cells.append(text("b"), 1, 2);
		cells.append(text("c"), 2, 3);
		cells.remove(first);

		expectList(cells, ["b", "c"]);
	});

	test("removing the last node promotes the one before it to the tail", () => {
		let cells = new Cells();

		cells.append(text("a"), 0, 1);

		let second = cells.append(text("b"), 1, 2);
		let third = cells.append(text("c"), 2, 3);

		cells.remove(third);

		expectList(cells, ["a", "b"]);
		expect(cells.last).toBe(second);
	});

	test("removing the only node empties the list", () => {
		let cells = new Cells();
		let only = cells.append(text("a"), 0, 1);

		cells.remove(only);

		expectList(cells, []);
		expect(cells.last).toBeNull();
	});

	test("removing both ends before the middle leaves the list walkable throughout", () => {
		let cells = new Cells();
		let first = cells.append(text("a"), 0, 1);
		let second = cells.append(text("b"), 1, 2);
		let third = cells.append(text("c"), 2, 3);
		let fourth = cells.append(text("d"), 3, 4);

		cells.remove(first);
		cells.remove(fourth);

		expectList(cells, ["b", "c"]);

		cells.remove(second);

		expectList(cells, ["c"]);

		cells.remove(third);

		expectList(cells, []);
	});

	test("a removed cell keeps no handle on the list it left", () => {
		let cells = new Cells();

		cells.append(text("a"), 0, 1);

		let middle = cells.append(text("b"), 1, 2);

		cells.append(text("c"), 2, 3);
		cells.remove(middle);

		expect(middle.previous).toBeNull();
		expect(middle.next).toBeNull();
	});
});

describe("extracting a range", () => {
	test("takes the run between two cells and joins what is left around it", () => {
		let cells = new Cells();

		cells.append(text("a"), 0, 1);

		let second = cells.append(text("b"), 1, 2);

		cells.append(text("c"), 2, 3);

		let fourth = cells.append(text("d"), 3, 4);
		let taken = cells.extract(second, fourth);

		expect(taken.map(label)).toEqual(["b", "c"]);
		expectList(cells, ["a", "d"]);
	});

	test("takes the rest of the list when it is given no cell to stop before", () => {
		let cells = new Cells();
		let first = cells.append(text("a"), 0, 1);
		let second = cells.append(text("b"), 1, 2);

		cells.append(text("c"), 2, 3);

		let taken = cells.extract(second, null);

		expect(taken.map(label)).toEqual(["b", "c"]);
		expectList(cells, ["a"]);
		expect(cells.last).toBe(first);
	});

	test("takes the whole list when it starts at the head and stops nowhere", () => {
		let cells = new Cells();
		let first = cells.append(text("a"), 0, 1);

		cells.append(text("b"), 1, 2);

		let taken = cells.extract(first, null);

		expect(taken.map(label)).toEqual(["a", "b"]);
		expectList(cells, []);
	});

	test("takes nothing when it is given no cell to start from", () => {
		let cells = new Cells();

		cells.append(text("a"), 0, 1);
		cells.append(text("b"), 1, 2);

		expect(cells.extract(null, null)).toEqual([]);
		expectList(cells, ["a", "b"]);
	});

	test("takes nothing when the run starts where it stops", () => {
		let cells = new Cells();

		cells.append(text("a"), 0, 1);

		let second = cells.append(text("b"), 1, 2);

		cells.append(text("c"), 2, 3);

		expect(cells.extract(second, second)).toEqual([]);
		expectList(cells, ["a", "b", "c"]);
	});

	test("every cell it takes keeps no handle on the list", () => {
		let cells = new Cells();

		cells.append(text("a"), 0, 1);

		let second = cells.append(text("b"), 1, 2);
		let third = cells.append(text("c"), 2, 3);
		let fourth = cells.append(text("d"), 3, 4);

		cells.extract(second, fourth);

		expect(second.previous).toBeNull();
		expect(second.next).toBeNull();
		expect(third.previous).toBeNull();
		expect(third.next).toBeNull();
	});
});

describe("wrapping a run in a parent", () => {
	test("the parent takes the place of the run it claims, between the nodes around it", () => {
		let cells = new Cells();

		cells.append(text("x"), 0, 1);

		let opener = cells.append(text("*"), 1, 2);

		cells.append(text("b"), 2, 3);
		cells.append(text("c"), 3, 4);

		let closer = cells.append(text("*"), 4, 5);

		cells.append(text("y"), 5, 6);

		let children = cells.extract(opener.next, closer);

		cells.insertAfter(closer, emphasis(children), opener.start, closer.end);
		cells.remove(opener);
		cells.remove(closer);

		expectList(cells, ["x", "(bc)", "y"]);
	});

	test("a parent claiming every node in the list becomes the whole list", () => {
		let cells = new Cells();
		let opener = cells.append(text("*"), 0, 1);

		cells.append(text("a"), 1, 2);

		let closer = cells.append(text("*"), 2, 3);
		let children = cells.extract(opener.next, closer);
		let wrapped = cells.insertAfter(closer, emphasis(children), opener.start, closer.end);

		cells.remove(opener);
		cells.remove(closer);

		expectList(cells, ["(a)"]);
		expect(cells.last).toBe(wrapped);
	});

	test("a parent may wrap a parent the list already holds", () => {
		let cells = new Cells();
		let first = cells.append(text("a"), 0, 1);
		let second = cells.append(text("b"), 1, 2);
		let third = cells.append(text("c"), 2, 3);
		let inner = cells.extract(second, third);
		let innerCell = cells.insertAfter(first, emphasis(inner), 1, 2);
		let outer = cells.extract(innerCell, null);

		cells.append(emphasis(outer), 1, 3);

		expectList(cells, ["a", "((b)c)"]);
	});
});
