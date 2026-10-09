/**
 * Checks the `frame` tag's vocabulary at parse time, since a `src` the page cannot
 * safely load must fail where the author wrote it rather than at render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { Markdown } from "../index.js";

import { FRAME_TAG } from "./frames.js";

const OPTIONS = { tags: { frame: FRAME_TAG } } satisfies Markdown.Options;

/** The first block of a parsed document, or the parse's failure message. */
function firstBlock(source: string): Markdown.Block | string {
	let result = Markdown.parse(source, OPTIONS);
	if (result.status === "failure") return result.error.message;
	return result.data.document.children[0]!;
}

describe("FRAME_TAG", () => {
	test("parses a self-closing frame with no fallback", () => {
		expect(firstBlock('<frame src="/frames/demo" />')).toMatchObject({
			type: "tag",
			name: "frame",
			attributes: { src: "/frames/demo" },
			children: [],
		});
	});

	test("parses the tag's children as markdown, which become the fallback", () => {
		expect(
			firstBlock('<frame src="/frames/demo" name="demo">\nLoading **now**\n</frame>'),
		).toMatchObject({
			type: "tag",
			attributes: { src: "/frames/demo", name: "demo" },
			children: [{ type: "paragraph", children: [{ type: "text" }, { type: "strong" }] }],
		});
	});

	test.each([
		["an absolute URL", "https://example.com/frame"],
		["a protocol-relative URL", "//example.com/frame"],
		["a relative path", "frames/demo"],
		["a script URL", "javascript:alert(1)"],
	])("refuses %s as src", (_label, src) => {
		expect(firstBlock(`<frame src="${src}" />`)).toBe("Invalid attributes for <frame>");
	});

	test("refuses a frame with no src", () => {
		expect(firstBlock("<frame />")).toBe("Invalid attributes for <frame>");
	});
});
