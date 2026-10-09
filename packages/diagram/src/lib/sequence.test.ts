/**
 * Specifies the sequence diagram subset: participants and actors, each arrow,
 * activations, notes, blocks and autonumbering, the room columns make for
 * labels, and the statements it refuses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseDiagram, toSVG } from "../index.js";

import type { SvgElement, SvgNode } from "./tree.js";

/**
 * @param body - Statements after the `sequenceDiagram` header
 * @returns The SVG markup
 */
function svg(body: string): string {
	let result = toSVG(`sequenceDiagram\n${body}`);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/**
 * @param body - Statements after the `sequenceDiagram` header
 * @returns Every element in the drawing, depth first
 */
function elements(body: string): SvgElement[] {
	let result = parseDiagram(`sequenceDiagram\n${body}`);
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
 * @param body - Statements after the `sequenceDiagram` header
 * @returns The reason the diagram fails with
 */
function reason(body: string): string {
	let result = parseDiagram(`sequenceDiagram\n${body}`);
	if (isSuccess(result)) throw new Error("Expected the diagram to fail");
	return result.error.reason;
}

/**
 * @param body - Statements after the `sequenceDiagram` header
 * @returns The x of each lifeline, left to right
 */
function lifelines(body: string): number[] {
	return elements(body)
		.filter((node) => node.name === "path" && node.attributes["stroke-dasharray"] === "4 4")
		.map((node) => Number(/^M([\d.-]+)/.exec(node.attributes.d ?? "")?.[1]));
}

describe("sequence diagrams", () => {
	test("declares participants in the order they are first named, top and bottom", () => {
		let markup = svg("participant B as Bob\nAlice->>B: Hi\nCarol->>Alice: Hey");

		expect(markup.match(/>Bob</g)?.length).toBe(2);
		expect(markup.indexOf(">Bob<")).toBeLessThan(markup.indexOf(">Alice<"));
		expect(markup.indexOf(">Alice<")).toBeLessThan(markup.indexOf(">Carol<"));
		expect(lifelines("participant B as Bob\nAlice->>B: Hi\nCarol->>Alice: Hey")).toHaveLength(3);
	});

	test("draws an actor as a figure", () => {
		let circles = elements("actor User\nUser->>API: go").filter((node) => node.name === "circle");

		expect(circles).toHaveLength(2);
	});

	test("draws each arrow with its stroke and head", () => {
		let solid = elements("A->>B: x").find(
			(node) => node.name === "path" && node.attributes.d?.includes(" L"),
		);
		let dashed = elements("A-->>B: x").filter(
			(node) => node.attributes["stroke-dasharray"] === "6 4",
		);
		let filled = (body: string) => elements(body).filter((node) => node.name === "polygon").length;

		expect(solid?.attributes["stroke-dasharray"]).toBeUndefined();
		expect(dashed).toHaveLength(1);
		expect(filled("A->>B: x")).toBe(1);
		expect(filled("A->B: x")).toBe(0);
		expect(filled("A<<->>B: x")).toBe(2);
		expect(svg("A-xB: x")).toMatch(/l8 8 M/);
		expect(filled("A-)B: x")).toBe(0);
	});

	test("reads a message without text", () => {
		expect(svg("A->>B")).toContain(">A<");
	});

	test("widens the gap between columns to fit a message's text", () => {
		let [narrow = 0, next = 0] = lifelines("A->>B: x");
		let [left = 0, right = 0] = lifelines(
			"A->>B: a message long enough to need far more room than a box",
		);

		expect(right - left).toBeGreaterThan(next - narrow + 100);
	});

	test("draws activation bars from + and - and from activate statements", () => {
		let bars = (body: string) =>
			elements(body).filter((node) => node.name === "rect" && node.attributes.width === "10")
				.length;

		expect(bars("A->>+B: go\nB-->>-A: done")).toBe(1);
		expect(bars("activate A\nA->>B: go\ndeactivate A")).toBe(1);
		expect(bars("activate A\nactivate A\nA->>B: go")).toBe(2);
	});

	test("draws a message to its own sender as a loop beside its lifeline", () => {
		expect(svg("A->>A: think")).toContain(">think<");
	});

	test("draws notes beside and over participants", () => {
		let markup = svg("A->>B: x\nNote right of A: right\nNote left of B: left\nNote over A,B: both");

		expect(markup).toContain(">right<");
		expect(markup).toContain(">left<");
		expect(markup).toContain(">both<");
	});

	test("frames blocks with their kind, condition and sections", () => {
		let markup = svg(
			"alt ok\nA->>B: yes\nelse failed\nA->>B: no\nend\nloop every minute\nA->>B: ping\nend",
		);

		expect(markup).toContain(">alt<");
		expect(markup).toContain(">[ok]<");
		expect(markup).toContain(">[failed]<");
		expect(markup).toContain(">loop<");
		expect(markup).toContain(">[every minute]<");
	});

	test("shades a rect block without a frame", () => {
		let markup = svg("rect rgb(200, 200, 255)\nA->>B: x\nend");

		expect(markup).not.toContain(">rect<");
	});

	test("numbers every message after autonumber", () => {
		let markup = svg("autonumber\nA->>B: one\nB-->>A: two");

		expect(markup).toContain(">1</text>");
		expect(markup).toContain(">2</text>");
	});

	test("breaks a label on <br>", () => {
		let markup = svg("A->>B: first<br/>second");

		expect(markup).toContain(">first</tspan>");
		expect(markup).toContain(">second</tspan>");
	});

	test("refuses blocks that do not open or close", () => {
		expect(reason("end")).toBe('"end" without a block to close');
		expect(reason("else nope")).toBe('"else" outside a block it continues');
		expect(reason("loop forever\nA->>B: x")).toBe('Unclosed "loop" block');
		expect(reason("opt x\nelse y\nend")).toBe('"else" outside a block it continues');
	});

	test("refuses to deactivate a participant that is not active", () => {
		expect(reason("A->>B: x\ndeactivate B")).toBe('"B" is not active');
	});

	test("refuses a note over three participants", () => {
		expect(reason("Note over A,B,C: x")).toBe(
			"A note spans at most two participants, and only over them",
		);
	});

	test("refuses statements outside the subset, pointing at them", () => {
		let result = parseDiagram("sequenceDiagram\n  A->>B: x\n  box Aqua Group");
		if (isSuccess(result)) throw new Error("Expected the diagram to fail");

		expect(result.error.reason).toBe('Unknown sequence diagram statement "box Aqua Group"');
		expect(result.error.line).toBe(3);
		expect(result.error.column).toBe(3);
	});
});
