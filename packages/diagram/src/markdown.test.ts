/**
 * Specifies the markdown visitor: which code blocks it claims as diagrams, the
 * tag nodes it leaves in their place, how it reports a diagram that does not
 * parse, and the HTML tag renderer that turns those nodes into SVG.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, expectTypeOf, test } from "vitest";

import { createDiagramVisitor, diagram, renderDiagram } from "./markdown.js";

import { DiagramError } from "./index.js";

/**
 * @param source - Markdown to parse
 * @returns The document it holds
 */
function parse(source: string): Markdown.Document {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) throw parsed.error;
	return parsed.data.document;
}

/**
 * @param document - The document to walk with the default visitor
 * @returns The walked document
 */
function walk(document: Markdown.Document): Markdown.Document {
	let walked = Markdown.walk(document, diagram);
	if (isFailure(walked)) throw walked.error;
	return walked.data;
}

describe("diagram visitor", () => {
	test("turns a mermaid fence into a diagram tag carrying its source", () => {
		let walked = walk(parse("```mermaid\nflowchart LR\nA --> B\n```\n"));

		expect(walked.children[0]).toMatchObject({
			type: "tag",
			name: "diagram",
			attributes: { source: "flowchart LR\nA --> B" },
			children: [],
		});
	});

	test("keeps the fence's position on the tag", () => {
		let document = parse("Intro\n\n```mermaid\nflowchart LR\nA\n```\n");
		let walked = walk(document);

		expect(walked.children[1]?.position).toEqual(document.children[1]?.position);
	});

	test("leaves every other code block as the same node", () => {
		let document = parse("```ts\nlet x = 1;\n```\n\n```\nflowchart LR\n```\n");

		expect(walk(document)).toBe(document);
	});

	test("fails the walk on a diagram that does not parse, at the fence", () => {
		let walked = Markdown.walk(parse("Intro\n\n```mermaid\nsequenceDiagram\nend\n```\n"), diagram);

		expect(isFailure(walked)).toBe(true);
		if (isSuccess(walked)) return;
		expect(walked.error.cause).toBeInstanceOf(DiagramError);
		expect(walked.error.position?.start.line).toBe(3);
		expect((walked.error.cause as DiagramError).line).toBe(2);
	});

	test("keeps the code block of a diagram that does not parse when asked to", () => {
		let document = parse("```mermaid\npie title Pets\n```\n");
		let walked = Markdown.walk(document, createDiagramVisitor({ invalid: "keep" }));

		expect(walked).toEqual({ status: "success", data: document });
	});

	test("composes with other code visitors in one walk", () => {
		let shout = {
			code: (node: Markdown.Code) => ({ ...node, content: node.content.toUpperCase() }),
		};
		let walked = Markdown.walk(
			parse("```mermaid\nflowchart LR\n```\n\n```txt\nhi\n```\n"),
			Markdown.compose(diagram, shout),
		);
		if (isFailure(walked)) throw walked.error;

		expect(walked.data.children[0]?.type).toBe("tag");
		expect(walked.data.children[1]).toMatchObject({ type: "code", content: "HI\n" });
	});

	test("walks synchronously", () => {
		let walked = Markdown.walk(parse("x"), diagram);

		expectTypeOf(walked).toEqualTypeOf<Result<Markdown.Document, Markdown.WalkError>>();
	});
});

describe("renderDiagram", () => {
	test("renders a diagram tag as SVG through toHTML", () => {
		let html = toHTML(walk(parse("Before\n\n```mermaid\nflowchart LR\nA --> B\n```\n")), {
			tags: { diagram: renderDiagram },
		});

		expect(html).toContain("<p>Before</p>");
		expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
		expect(html).toContain("<title>Flowchart</title>");
	});

	test("renders source that does not parse as an escaped code block", () => {
		let html = renderDiagram({
			name: "diagram",
			attributes: { source: "graph <x>\nA[" },
			children: "",
		});

		expect(html).toBe('<pre><code class="language-mermaid">graph &lt;x&gt;\nA[</code></pre>');
	});
});
