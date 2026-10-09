/**
 * Specifies the diagram component: the SVG it renders from Mermaid source, its
 * fallback for source that does not parse, and its use as the component a
 * markdown renderer draws a diagram tag with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/* @jsxImportSource remix/component */

import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { diagram } from "./markdown.js";
import { Diagram, DiagramTag } from "./ui.js";

describe("Diagram and DiagramTag", () => {
	test("renders Mermaid source as SVG elements", async () => {
		let html = await renderToString(<Diagram source={"sequenceDiagram\nAlice->>Bob: Hi"} />);

		expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
		expect(html).toContain(">Alice</text>");
		expect(html).toContain(">Hi</text>");
		expect(html).toContain('role="img"');
	});

	test("renders source that does not parse as a code block", async () => {
		let html = await renderToString(<Diagram source="pie <x>" />);

		expect(html).toBe('<pre><code class="language-mermaid">pie &lt;x&gt;</code></pre>');
	});

	test("draws the diagram tags a walk leaves through toRemix", async () => {
		let parsed = Markdown.parse("```mermaid\nstateDiagram-v2\n[*] --> Ready\n```\n");
		if (isFailure(parsed)) throw parsed.error;
		let walked = Markdown.walk(parsed.data.document, diagram);
		if (isFailure(walked)) throw walked.error;

		let html = await renderToString(toRemix(walked.data, { components: { diagram: DiagramTag } }));

		expect(html).toContain("<title>State diagram</title>");
		expect(html).toContain(">Ready</text>");
	});

	test("names the SVG from alt, through the component and through a walked tag", async () => {
		let direct = await renderToString(
			<Diagram source={"flowchart LR\nA --> B"} alt="A leads to B" />,
		);
		expect(direct).toContain("<title>A leads to B</title>");

		let parsed = Markdown.parse(
			'```mermaid {% alt="Ready on start" %}\nstateDiagram-v2\n[*] --> Ready\n```\n',
		);
		if (isFailure(parsed)) throw parsed.error;
		let walked = Markdown.walk(parsed.data.document, diagram);
		if (isFailure(walked)) throw walked.error;

		let html = await renderToString(toRemix(walked.data, { components: { diagram: DiagramTag } }));

		expect(html).toContain("<title>Ready on start</title>");
	});
});
