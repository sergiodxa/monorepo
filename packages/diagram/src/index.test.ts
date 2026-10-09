/**
 * Specifies the entry points every diagram kind shares: the root element and
 * its accessible name, the escaping of every serialized value, and where a
 * failure points in the source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { SvgElement } from "./index.js";

import { DiagramError, parseDiagram, toSVG } from "./index.js";

/**
 * @param source - A diagram that must parse
 * @returns Its SVG tree
 */
function tree(source: string): SvgElement {
	let result = parseDiagram(source);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/**
 * @param source - A diagram that must fail
 * @returns The error it fails with
 */
function error(source: string): DiagramError {
	let result = parseDiagram(source);
	if (isSuccess(result)) throw new Error("Expected the diagram to fail");
	return result.error;
}

/**
 * @param node - An element
 * @param name - The child element to find
 * @returns The text of its first child element with that name
 */
function childText(node: SvgElement, name: string): string | undefined {
	let child = node.children.find((item) => item.type === "element" && item.name === name);
	if (child?.type !== "element") return undefined;
	let [text] = child.children;
	return text?.type === "text" ? text.value : undefined;
}

describe("parseDiagram", () => {
	test("roots every kind in an svg element sized to its drawing", () => {
		for (let source of [
			"sequenceDiagram\nA->>B: hi",
			"classDiagram\nclass A",
			"stateDiagram-v2\n[*] --> A",
			"flowchart LR\nA --> B",
			"graph TD\nA --> B",
		]) {
			let root = tree(source);
			expect(root.name).toBe("svg");
			expect(root.attributes.xmlns).toBe("http://www.w3.org/2000/svg");
			expect(root.attributes.role).toBe("img");
			expect(root.attributes.viewBox).toBe(
				`0 0 ${root.attributes.width} ${root.attributes.height}`,
			);
			expect(Number(root.attributes.width)).toBeGreaterThan(0);
		}
	});

	test("names the drawing after its kind", () => {
		expect(childText(tree("sequenceDiagram\nA->>B: hi"), "title")).toBe("Sequence diagram");
		expect(childText(tree("classDiagram\nclass A"), "title")).toBe("Class diagram");
		expect(childText(tree("stateDiagram\n[*] --> A"), "title")).toBe("State diagram");
		expect(childText(tree("flowchart\nA"), "title")).toBe("Flowchart");
	});

	test("names it from a title, accTitle or frontmatter title, and describes it from accDescr", () => {
		expect(childText(tree("flowchart LR\ntitle Checkout\nA --> B"), "title")).toBe("Checkout");
		expect(childText(tree("flowchart LR\naccTitle: Checkout\nA --> B"), "title")).toBe("Checkout");
		expect(childText(tree('---\ntitle: "Checkout"\n---\nflowchart LR\nA --> B'), "title")).toBe(
			"Checkout",
		);

		let described = tree("sequenceDiagram\naccDescr: Alice greets Bob\nAlice->>Bob: hi");
		expect(childText(described, "desc")).toBe("Alice greets Bob");
	});

	test("skips blank lines and %% comments", () => {
		let result = toSVG("\n%% a comment\nflowchart LR\n\n  %% another\nA --> B\n");

		expect(isSuccess(result)).toBe(true);
	});

	test("draws the same markup for the same source", () => {
		let source = "flowchart TD\nA --> B & C --> D\nB --> A";

		expect(toSVG(source)).toEqual(toSVG(source));
	});

	test("fails on a kind it does not draw, pointing at the header", () => {
		let failure = error("\n  pie title Pets\n");

		expect(failure).toBeInstanceOf(DiagramError);
		expect(failure.reason).toContain('Unknown diagram type "pie"');
		expect(failure.line).toBe(2);
		expect(failure.column).toBe(3);
		expect(failure.index).toBe(3);
		expect(failure.message).toMatch(/at 2:3$/);
	});

	test("fails on empty source and on frontmatter that never closes", () => {
		expect(error("  \n%% nothing\n").reason).toBe("Empty diagram");
		expect(error("---\ntitle: x\nflowchart").reason).toBe("Unclosed frontmatter");
	});
});

describe("toSVG", () => {
	test("escapes every label and attribute value", () => {
		let result = toSVG('flowchart LR\nA["a < b & c"] -->|"say &quot;"| B\ntitle <Flow & "co">');
		if (isFailure(result)) throw result.error;

		expect(result.data).toContain("a &lt; b &amp; c");
		expect(result.data).toContain('<title>&lt;Flow &amp; "co"&gt;</title>');
		expect(result.data).not.toContain("<Flow");
	});

	test("writes every element with a closing tag, so XML parsers read it too", () => {
		let result = toSVG("stateDiagram-v2\n[*] --> A\nA --> [*]");
		if (isFailure(result)) throw result.error;

		expect(result.data).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
		expect(result.data).not.toMatch(/\/>/);
		expect(result.data.endsWith("</svg>")).toBe(true);
	});

	test("hands back the parse failure", () => {
		let result = toSVG("sequenceDiagram\nend");

		expect(isFailure(result)).toBe(true);
	});
});
