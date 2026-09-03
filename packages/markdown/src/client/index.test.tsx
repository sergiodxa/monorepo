/**
 * Confirms `MarkdownView` renders a Markdoc AST into HTML through the
 * Handle<Props> component model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import Markdoc from "@markdoc/markdoc";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { MarkdownView } from "./index.js";

describe("MarkdownView", () => {
	test("renders as JSX, following the Handle<Props> component model", async () => {
		let ast = Markdoc.parse("# Hello\n\nWorld paragraph.");
		let content = Markdoc.transform(ast);

		let html = await renderToString(<MarkdownView content={content} />);

		expect(html).toContain("<h1");
		expect(html).toContain("Hello");
		expect(html).toContain("<p");
		expect(html).toContain("World paragraph.");
	});
});
