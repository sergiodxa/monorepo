/**
 * Specifies the flowchart subset: every node shape, every link form with its
 * stroke, heads, text and length, chains, subgraphs, and the statements it
 * reads past or refuses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseDiagram } from "../index.js";

import type { SvgElement, SvgNode } from "./tree.js";

/**
 * @param source - A whole flowchart, header included
 * @returns Every element in the drawing, depth first
 */
function elements(source: string): SvgElement[] {
	let result = parseDiagram(source);
	if (isFailure(result)) throw result.error;
	let found: SvgElement[] = [];
	let visit = (node: SvgNode): void => {
		if (node.type !== "element") return;
		found.push(node);
		node.children.forEach(visit);
	};
	visit(result.data);
	return found;
}

/**
 * @param source - A whole flowchart
 * @returns Every text run in it, title included
 */
function texts(source: string): string[] {
	return elements(source).flatMap((node) =>
		node.children.flatMap((child) => (child.type === "text" ? [child.value] : [])),
	);
}

/**
 * @param source - A whole flowchart
 * @param value - A label it draws once
 * @returns Where that label is centered
 */
function at(source: string, value: string): { x: number; y: number } {
	let node = elements(source).find(
		(item) =>
			item.name === "text" &&
			item.children.some((child) => child.type === "text" && child.value === value),
	);
	if (!node) throw new Error(`No label ${value}`);
	return { x: Number(node.attributes.x), y: Number(node.attributes.y) };
}

/**
 * @param source - A whole flowchart that must fail
 * @returns The error's reason and column
 */
function failure(source: string): { reason: string; column: number } {
	let result = parseDiagram(source);
	if (isSuccess(result)) throw new Error("Expected the flowchart to fail");
	return { reason: result.error.reason, column: result.error.column };
}

/**
 * @param source - A whole flowchart
 * @returns The connector paths, which are the paths with no fill that carry an `L` or `Q`
 */
function links(source: string): SvgElement[] {
	return elements(source).filter(
		(node) =>
			node.name === "path" &&
			node.attributes.fill === "none" &&
			/[LQ]/.test(node.attributes.d ?? ""),
	);
}

describe("flowcharts", () => {
	test("labels a node with its id until a shape gives it text", () => {
		expect(texts("flowchart LR\nA --> B\nB[Second]")).toEqual(
			expect.arrayContaining(["A", "Second"]),
		);
		expect(texts("flowchart LR\nA --> B\nB[Second]")).not.toContain("B");
	});

	test("draws every shape", () => {
		let shapes = (definition: string) =>
			elements(`flowchart LR\n${definition}`).filter((node) =>
				node.attributes.style?.includes("diagram-fill"),
			);
		let polygonPoints = (definition: string) =>
			(shapes(definition).find((node) => node.name === "polygon")?.attributes.points ?? "").split(
				" ",
			).length;

		expect(shapes("A[rect]")[0]?.name).toBe("rect");
		expect(shapes("A(round)")[0]?.attributes.rx).toBe("8");
		expect(Number(shapes("A([stadium])")[0]?.attributes.rx)).toBeGreaterThan(8);
		expect(shapes("A((circle))")[0]?.name).toBe("circle");
		expect(
			elements("flowchart LR\nA(((double)))").filter((node) => node.name === "circle"),
		).toHaveLength(2);
		expect(shapes("A[(db)]")[0]?.name).toBe("path");
		expect(polygonPoints("A{diamond}")).toBe(4);
		expect(polygonPoints("A{{hexagon}}")).toBe(6);
		expect(polygonPoints("A[/lean/]")).toBe(4);
		expect(polygonPoints("A[\\lean\\]")).toBe(4);
		expect(polygonPoints("A[/trap\\]")).toBe(4);
		expect(polygonPoints("A[\\trap/]")).toBe(4);
		expect(polygonPoints("A>flag]")).toBe(5);
		expect(texts("flowchart LR\nA[[sub]]")).toContain("sub");
	});

	test("reads quoted text, which may hold the shape's own brackets", () => {
		expect(texts('flowchart LR\nA["a [b] c"]')).toContain("a [b] c");
	});

	test("refuses a shape that never closes, pointing at the node", () => {
		expect(failure("flowchart LR\nA --> B[open")).toEqual({
			reason: 'Unclosed shape for "B"',
			column: 7,
		});
	});

	test("draws each stroke", () => {
		expect(links("flowchart LR\nA --> B")[0]?.attributes["stroke-dasharray"]).toBeUndefined();
		expect(links("flowchart LR\nA -.-> B")[0]?.attributes["stroke-dasharray"]).toBe("2 3");
		expect(links("flowchart LR\nA ==> B")[0]?.attributes["stroke-width"]).toBe("3");
		expect(links("flowchart LR\nA ~~~ B")).toHaveLength(0);
	});

	test("draws each head at either end", () => {
		let heads = (link: string) => {
			let all = elements(`flowchart LR\nA ${link} B`);
			return {
				arrows: all.filter((node) => node.name === "polygon").length,
				circles: all.filter((node) => node.name === "circle").length,
				crosses: all.filter((node) => /l8 8/.test(node.attributes.d ?? "")).length,
			};
		};

		expect(heads("-->")).toEqual({ arrows: 1, circles: 0, crosses: 0 });
		expect(heads("---")).toEqual({ arrows: 0, circles: 0, crosses: 0 });
		expect(heads("<-->")).toEqual({ arrows: 2, circles: 0, crosses: 0 });
		expect(heads("--o")).toEqual({ arrows: 0, circles: 1, crosses: 0 });
		expect(heads("o--o")).toEqual({ arrows: 0, circles: 2, crosses: 0 });
		expect(heads("--x")).toEqual({ arrows: 0, circles: 0, crosses: 1 });
		expect(heads("x--x")).toEqual({ arrows: 0, circles: 0, crosses: 2 });
	});

	test("reads link text between pipes and inside the link", () => {
		expect(texts("flowchart LR\nA -->|yes| B")).toContain("yes");
		expect(texts("flowchart LR\nA -- maybe --> B")).toContain("maybe");
		expect(texts("flowchart LR\nA -. later .-> B")).toContain("later");
		expect(texts("flowchart LR\nA == now ==> B")).toContain("now");
		expect(texts("flowchart LR\nA -- plain --- B")).toContain("plain");
	});

	test("refuses two dashes with no head or text", () => {
		expect(failure("flowchart LR\nA -- B").reason).toBe("Expected a link between nodes");
	});

	test("ranks a longer link further away", () => {
		let source = "flowchart TD\nA --> B\nA ----> C";

		expect(at(source, "C").y).toBeGreaterThan(at(source, "B").y);
	});

	test("links every node of one & group to every node of the next", () => {
		expect(links("flowchart LR\nA & B --> C & D")).toHaveLength(4);
		expect(links("flowchart LR\nA --> B --> C")).toHaveLength(2);
	});

	test("follows the direction from the header", () => {
		let across = "flowchart LR\nA --> B";
		let down = "graph TD\nA --> B";
		let up = "flowchart BT\nA --> B";

		expect(at(across, "B").x).toBeGreaterThan(at(across, "A").x);
		expect(at(down, "B").y).toBeGreaterThan(at(down, "A").y);
		expect(at(up, "B").y).toBeLessThan(at(up, "A").y);
		expect(at("flowchart\ndirection LR\nA --> B", "B").x).toBeGreaterThan(
			at("flowchart\ndirection LR\nA --> B", "A").x,
		);
	});

	test("splits statements on semicolons outside text", () => {
		expect(texts('flowchart LR\nA --> B; B --> C["x; y"];')).toEqual(
			expect.arrayContaining(["A", "B", "x; y"]),
		);
	});

	test("reads past styling and click statements", () => {
		let source =
			"flowchart LR\nA:::hot --> B\nclassDef hot fill:#f00\nclass A hot\nstyle B stroke:#333\nlinkStyle 0 stroke:red\nclick A callback";

		expect(texts(source)).toEqual(expect.arrayContaining(["A", "B"]));
	});

	test("draws a subgraph around the nodes named in it, wherever they were first named", () => {
		let source = "flowchart TD\nA --> B\nsubgraph group [The group]\nB\nC\nend\nA --> C";
		let all = elements(source);
		let frame = all.find(
			(node) => node.name === "rect" && node.attributes.style?.includes("diagram-tint"),
		);
		let top = Number(frame?.attributes.y);
		let bottom = top + Number(frame?.attributes.height);

		expect(texts(source)).toContain("The group");
		expect(at(source, "B").y).toBeGreaterThan(top);
		expect(at(source, "C").y).toBeLessThan(bottom);
		expect(at(source, "A").y).toBeLessThan(top);
	});

	test("links to a subgraph by its id and reads a titled subgraph without an id", () => {
		let source = "flowchart LR\nsubgraph One\nA\nend\nsubgraph two [Two]\nB\nend\nOne --> two";

		expect(texts(source)).toEqual(expect.arrayContaining(["One", "Two"]));
		expect(texts(source)).not.toContain("two");
		expect(links(source)).toHaveLength(1);
	});

	test("refuses subgraphs that do not open or close", () => {
		expect(failure("flowchart LR\nend").reason).toBe('"end" without a subgraph to close');
		expect(failure("flowchart LR\nsubgraph x\nA").reason).toBe("Unclosed subgraph");
	});

	test("refuses a statement that is not a chain of nodes", () => {
		expect(failure("flowchart LR\n--> B").reason).toBe("Expected a node id");
	});
});
