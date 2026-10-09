/**
 * Specifies the state diagram subset: states, descriptions, start and end per
 * scope, transitions and their labels, pseudo-states, notes, composite states,
 * and the statements it refuses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseDiagram } from "../index.js";

import type { SvgElement, SvgNode } from "./tree.js";

/**
 * @param body - Statements after the `stateDiagram-v2` header
 * @returns Every element in the drawing, depth first
 */
function elements(body: string): SvgElement[] {
	let result = parseDiagram(`stateDiagram-v2\n${body}`);
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
 * @returns Every text run in the drawing
 */
function texts(body: string): string[] {
	return elements(body).flatMap((node) =>
		node.children.flatMap((child) => (child.type === "text" ? [child.value] : [])),
	);
}

/**
 * @param body - Statements after the header
 * @param value - A label the drawing holds once
 * @returns Where it is centered
 */
function at(body: string, value: string): { x: number; y: number } {
	let node = elements(body).find(
		(item) =>
			item.name === "text" &&
			item.children.some((child) => child.type === "text" && child.value === value),
	);
	if (!node) throw new Error(`No label ${value}`);
	return { x: Number(node.attributes.x), y: Number(node.attributes.y) };
}

/**
 * @param body - Statements after the header that must fail
 * @returns The reason
 */
function reason(body: string): string {
	let result = parseDiagram(`stateDiagram-v2\n${body}`);
	if (isSuccess(result)) throw new Error("Expected the diagram to fail");
	return result.error.reason;
}

/**
 * @param body - Statements after the header
 * @returns How many filled circles it draws: one per start, one per end's center
 */
function dots(body: string): number {
	return elements(body).filter(
		(node) => node.name === "circle" && node.attributes.style === "fill: currentColor",
	).length;
}

describe("state diagrams", () => {
	test("draws a start for [*] as a source and an end for [*] as a target", () => {
		let body = "[*] --> Idle\nIdle --> [*]";
		let rings = elements(body).filter(
			(node) => node.name === "circle" && node.attributes.style?.includes("diagram-fill"),
		);

		expect(dots(body)).toBe(2);
		expect(rings).toHaveLength(1);
		expect(texts(body)).not.toContain("[*]");
	});

	test("shares one start and one end per scope", () => {
		expect(dots("[*] --> A\n[*] --> B\nA --> [*]\nB --> [*]")).toBe(2);
	});

	test("labels transitions and flows them down the page", () => {
		let body = "Idle --> Running : start";

		expect(texts(body)).toContain("start");
		expect(at(body, "Running").y).toBeGreaterThan(at(body, "Idle").y);
	});

	test("names a state from state … as and lists its descriptions under a divider", () => {
		let body =
			'state "Waiting for payment" as Waiting\nWaiting : Times out after an hour\nWaiting : Retries twice';

		expect(texts(body)).toEqual(
			expect.arrayContaining(["Waiting for payment", "Times out after an hour", "Retries twice"]),
		);
		expect(texts(body)).not.toContain("Waiting");
	});

	test("draws choice as a diamond and fork and join as filled bars", () => {
		let body =
			"state pick <<choice>>\nstate split <<fork>>\nstate merge <<join>>\n[*] --> pick\npick --> split\nsplit --> merge";
		let bars = elements(body).filter(
			(node) => node.name === "rect" && node.attributes.style === "fill: currentColor",
		);

		expect(
			elements(body).filter(
				(node) => node.name === "polygon" && node.attributes.points?.split(" ").length === 4,
			).length,
		).toBeGreaterThanOrEqual(1);
		expect(bars).toHaveLength(2);
		expect(bars[0]?.attributes.width).toBe("80");
		expect(texts(body)).not.toContain("pick");
	});

	test("turns fork bars across a left-to-right flow", () => {
		let bars = elements("direction LR\nstate split <<fork>>\nA --> split").filter(
			(node) => node.name === "rect" && node.attributes.style === "fill: currentColor",
		);

		expect(bars[0]?.attributes.height).toBe("80");
	});

	test("nests a composite state's own diagram inside it, with its own start", () => {
		let body =
			"[*] --> Active\nstate Active {\n[*] --> Working\nWorking --> Paused\n}\nActive --> Done";
		let frame = elements(body).find(
			(node) =>
				node.name === "rect" && node.attributes.rx === "8" && Number(node.attributes.height) > 100,
		);
		let top = Number(frame?.attributes.y);

		expect(dots(body)).toBe(2);
		expect(at(body, "Working").y).toBeGreaterThan(top);
		expect(at(body, "Done").y).toBeGreaterThan(at(body, "Paused").y);
	});

	test("draws notes on one line or several, linked to their state", () => {
		let body =
			"A --> B\nnote right of A : quick\nnote left of B\n  first line\n  second line\nend note";
		let dashed = elements(body).filter((node) => node.attributes["stroke-dasharray"] === "6 4");

		expect(texts(body)).toEqual(expect.arrayContaining(["quick", "first line", "second line"]));
		expect(dashed).toHaveLength(2);
	});

	test("reads a bare state, styling statements and :::class suffixes", () => {
		expect(texts("Lonely\nclassDef hot fill:red\nA:::hot --> B\nclass A hot")).toEqual(
			expect.arrayContaining(["Lonely", "A", "B"]),
		);
	});

	test("refuses composites and notes that never close, and concurrent regions", () => {
		expect(reason("state A {\nB --> C")).toBe('Unclosed composite state "A"');
		expect(reason("}")).toBe('"}" without a composite state to close');
		expect(reason("note left of A\ntext")).toBe('Unclosed note; end it with "end note"');
		expect(reason("state A {\nB\n--\nC\n}")).toBe("Concurrent regions are not supported");
		expect(reason("A -> B")).toBe('Unknown state diagram statement "A -> B"');
	});
});
