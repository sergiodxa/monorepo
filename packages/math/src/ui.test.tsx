/**
 * Specifies the math component: the MathML it renders on the server from TeX,
 * its fallback for TeX that does not convert, and its use as the component a
 * markdown renderer draws a math tag with.
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

import { math } from "./markdown.js";
import { MathFormula, MathTag } from "./ui.js";

describe("MathFormula and MathTag", () => {
	test("renders TeX as MathML elements", async () => {
		let html = await renderToString(<MathFormula tex="x^2" display />);

		expect(html).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">');
		expect(html).toContain("<msup><mi>x</mi><mn>2</mn></msup>");
		expect(html).toContain('<annotation encoding="application/x-tex">x^2</annotation>');
	});

	test("renders inline when display is left out", async () => {
		let html = await renderToString(<MathFormula tex="a<b" />);

		expect(html).toContain('display="inline"');
		expect(html).toContain("<mo>&lt;</mo>");
	});

	test("renders TeX that does not convert as code", async () => {
		let html = await renderToString(<MathFormula tex="\foo" />);

		expect(html).toBe("<code>\\foo</code>");
	});

	test("draws the math tags a walk leaves through toRemix", async () => {
		let parsed = Markdown.parse("```math\n\\frac{1}{2}\n```\n");
		if (isFailure(parsed)) throw parsed.error;
		let walked = Markdown.walk(parsed.data.document, math);
		if (isFailure(walked)) throw walked.error;

		let html = await renderToString(toRemix(walked.data, { components: { math: MathTag } }));

		expect(html).toContain("<mfrac><mn>1</mn><mn>2</mn></mfrac>");
	});
});
