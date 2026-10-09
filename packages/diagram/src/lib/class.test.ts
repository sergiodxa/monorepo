/**
 * Specifies the class diagram subset: class boxes and their compartments,
 * member classifiers and generics, each relation's line and heads, labels,
 * cardinalities, notes and namespaces, and the statements it refuses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseDiagram } from "../index.js";

import type { SvgElement, SvgNode } from "./tree.js";

/**
 * @param body - Statements after the `classDiagram` header
 * @returns Every element in the drawing, depth first
 */
function elements(body: string): SvgElement[] {
	let result = parseDiagram(`classDiagram\n${body}`);
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
 * @param body - Statements after the header
 * @param value - A label the drawing holds once
 * @returns The `text` element drawing it
 */
function text(body: string, value: string): SvgElement {
	let node = elements(body).find(
		(item) =>
			item.name === "text" &&
			item.children.some((child) => child.type === "text" && child.value === value),
	);
	if (!node) throw new Error(`No label ${value}`);
	return node;
}

/**
 * @param body - Statements after the header that must fail
 * @returns The reason
 */
function reason(body: string): string {
	let result = parseDiagram(`classDiagram\n${body}`);
	if (isSuccess(result)) throw new Error("Expected the diagram to fail");
	return result.error.reason;
}

describe("class diagrams", () => {
	test("draws a class's name in bold with its annotations above it", () => {
		let body = "class Shape {\n<<interface>>\n+area() double\n}\n<<abstract>> Base";

		expect(text(body, "Shape").attributes["font-weight"]).toBe("bold");
		expect(text(body, "«interface»").attributes["font-style"]).toBe("italic");
		expect(text(body, "«abstract»").attributes["font-style"]).toBe("italic");
	});

	test("files members with parentheses under methods and the rest under attributes", () => {
		let body = "class Duck {\n+String beak\n+swim() void\n}\nDuck : +int age\nDuck : +quack()";
		let y = (value: string) => Number(text(body, value).attributes.y);

		expect(text(body, "+String beak").attributes["text-anchor"]).toBe("start");
		expect(y("+String beak")).toBeLessThan(y("+int age"));
		expect(y("+int age")).toBeLessThan(y("+swim() void"));
		expect(y("+swim() void")).toBeLessThan(y("+quack()"));
	});

	test("underlines static members and slants abstract ones, dropping the classifier", () => {
		let body = "class A {\n+create()$ A\n+draw()*\n+String count$\n}";

		expect(text(body, "+create() A").attributes["text-decoration"]).toBe("underline");
		expect(text(body, "+draw()").attributes["font-style"]).toBe("italic");
		expect(text(body, "+String count").attributes["text-decoration"]).toBe("underline");
	});

	test("writes generics with angle brackets", () => {
		let body = "class Box~T~ {\n+List~T~ items\n}\nBox~T~ --> Other";

		expect(text(body, "Box<T>")).toBeDefined();
		expect(text(body, "+List<T> items")).toBeDefined();
	});

	test("uses a class's bracketed label in place of its name", () => {
		expect(text('class Animal["An animal"]', "An animal")).toBeDefined();
	});

	test("draws each relation's heads and line", () => {
		let heads = (relation: string) => {
			let all = elements(`A ${relation} B`);
			return {
				polygons: all.filter((node) => node.name === "polygon").length,
				dashed: all.some((node) => node.attributes["stroke-dasharray"] === "6 4"),
			};
		};

		expect(heads("<|--")).toEqual({ polygons: 1, dashed: false });
		expect(heads("..|>")).toEqual({ polygons: 1, dashed: true });
		expect(heads("*--")).toEqual({ polygons: 1, dashed: false });
		expect(heads("o--")).toEqual({ polygons: 1, dashed: false });
		expect(heads("-->")).toEqual({ polygons: 0, dashed: false });
		expect(heads("..>")).toEqual({ polygons: 0, dashed: true });
		expect(heads("--")).toEqual({ polygons: 0, dashed: false });
		expect(heads("..")).toEqual({ polygons: 0, dashed: true });
		expect(heads("<|--|>")).toEqual({ polygons: 2, dashed: false });
	});

	test("puts the parent of an inheritance above its child, written either way", () => {
		let y = (body: string, value: string) => Number(text(body, value).attributes.y);

		expect(y("Animal <|-- Duck", "Animal")).toBeLessThan(y("Animal <|-- Duck", "Duck"));
		expect(y("Duck --|> Animal", "Animal")).toBeLessThan(y("Duck --|> Animal", "Duck"));
		expect(y("Car --* Engine", "Engine")).toBeLessThan(y("Car --* Engine", "Car"));
	});

	test("draws a relation's label and both cardinalities", () => {
		let body = 'Customer "1" --> "*" Order : places';

		expect(text(body, "places")).toBeDefined();
		expect(text(body, "1")).toBeDefined();
		expect(text(body, "*")).toBeDefined();
	});

	test("draws notes, attached or free", () => {
		let body = 'class A\nnote for A "about A"\nnote "free<br>note"';
		let dashed = elements(body).filter((node) => node.attributes["stroke-dasharray"] === "6 4");

		expect(text(body, "about A")).toBeDefined();
		expect(dashed).toHaveLength(1);
		expect(
			elements(body).some(
				(node) =>
					node.name === "tspan" &&
					node.children[0]?.type === "text" &&
					node.children[0].value === "note",
			),
		).toBe(true);
	});

	test("frames a namespace around its classes", () => {
		let body = "namespace Shapes {\nclass Square\nclass Circle\n}\nSquare --> Circle";

		expect(text(body, "Shapes").attributes["font-weight"]).toBe("bold");
		expect(
			elements(body).filter((node) => node.attributes.style?.includes("diagram-tint")),
		).toHaveLength(1);
	});

	test("reads the direction and past styling statements", () => {
		let y = (body: string, value: string) => Number(text(body, value).attributes.y);
		let body = 'direction LR\nA --> B\nstyle A fill:#f9f\ncssClass "A" hot\nclick A call cb()';

		expect(y(body, "A")).toBe(y(body, "B"));
	});

	test("refuses bodies and namespaces that never close, and statements outside the subset", () => {
		expect(reason("class A {\n+x")).toBe('Unclosed body of class "A"');
		expect(reason("namespace N {\nclass A")).toBe('Unclosed namespace "N"');
		expect(reason("}")).toBe('"}" without a block to close');
		expect(reason("A <--> B <--> C")).toBe('Unknown class diagram statement "A <--> B <--> C"');
	});
});
