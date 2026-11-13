/**
 * Checks markdown pages expand emoji shortcodes during the shared walk that
 * also draws diagrams and paints code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseMarkdownPage } from "./markdown-page.js";

describe("parseMarkdownPage", () => {
	test("expands emoji shortcodes in the HTML document", () => {
		let page = parseMarkdownPage(
			["---", "title: Ship", "description: Celebrate", "---", "", "Ship it :tada:", ""].join("\n"),
		);
		if (isFailure(page)) throw page.error;
		let paragraph = page.data.document.children[0];
		expect(paragraph).toMatchObject({ type: "paragraph" });
		if (paragraph?.type !== "paragraph") return;
		expect(paragraph.children).toMatchObject([{ type: "text", value: "Ship it 🎉" }]);
	});
});
