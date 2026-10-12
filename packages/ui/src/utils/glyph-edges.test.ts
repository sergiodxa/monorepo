/**
 * Covers {@link glyphEdges}: element edges beside text are reported, text edges and
 * empty JSX slots are not, and a lone child reports neither edge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { glyphEdges } from "./glyph-edges.js";

/** Stand-in for a rendered JSX element: any non-array object. */
const GLYPH = { type: "svg", props: {} };

describe("glyphEdges", () => {
	test("reports a leading glyph before a label", () => {
		expect(glyphEdges([GLYPH, "Add"])).toEqual({ start: true, end: false });
	});

	test("reports a trailing glyph after a label", () => {
		expect(glyphEdges(["Next", GLYPH])).toEqual({ start: false, end: true });
	});

	test("reports both edges when a label sits between two glyphs", () => {
		expect(glyphEdges([GLYPH, "Sort", GLYPH])).toEqual({ start: true, end: true });
	});

	test("skips empty slots and whitespace when finding the edges", () => {
		expect(glyphEdges([null, false, " ", GLYPH, "Add", undefined])).toEqual({
			start: true,
			end: false,
		});
	});

	test("reports neither edge for a lone child or plain text", () => {
		expect(glyphEdges(GLYPH)).toEqual({ start: false, end: false });
		expect(glyphEdges("Save")).toEqual({ start: false, end: false });
		expect(glyphEdges([GLYPH, null])).toEqual({ start: false, end: false });
	});
});
