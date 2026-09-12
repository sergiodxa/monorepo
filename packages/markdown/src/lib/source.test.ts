/**
 * Pins the map from an index inside a leaf's collected text back to where it was
 * written: one chunk, chunks a container prefix shifted, an index on a boundary,
 * one past the end, and no chunks at all, since every inline position rests here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Chunk } from "./source.js";

import { emptyPosition, SourceText } from "./source.js";

/**
 * The two lines of `> foo` / `> bar`, whose `> ` prefix the block phase stripped,
 * so neither chunk starts at column 1 and the offsets skip the prefix.
 */
const QUOTED: Chunk[] = [
	{ text: "foo", line: 1, column: 3, offset: 2 },
	{ text: "bar", line: 2, column: 3, offset: 8 },
];

describe("SourceText", () => {
	test("joins its chunks with newlines into the text the inline phase reads", () => {
		expect(new SourceText(QUOTED).value).toBe("foo\nbar");
	});

	test("holds an empty text when it collected no chunks", () => {
		expect(new SourceText([]).value).toBe("");
	});

	test("maps an index inside a single chunk to the line it was written on", () => {
		let text = new SourceText([{ text: "hello", line: 3, column: 1, offset: 20 }]);

		expect(text.point(2)).toEqual({ line: 3, column: 3, offset: 22 });
	});

	test("maps the first index to the chunk's own origin", () => {
		expect(new SourceText(QUOTED).point(0)).toEqual({ line: 1, column: 3, offset: 2 });
	});

	test("carries the column a container prefix shifted into the second chunk", () => {
		expect(new SourceText(QUOTED).point(5)).toEqual({ line: 2, column: 4, offset: 9 });
	});

	test("maps an index landing on a chunk boundary to the start of that chunk", () => {
		expect(new SourceText(QUOTED).point(4)).toEqual({ line: 2, column: 3, offset: 8 });
	});

	test("maps the index of the joining newline to one past its line's last character", () => {
		expect(new SourceText(QUOTED).point(3)).toEqual({ line: 1, column: 6, offset: 5 });
	});

	test("maps the last index to one past the final character", () => {
		expect(new SourceText(QUOTED).point(7)).toEqual({ line: 2, column: 6, offset: 11 });
	});

	test("clamps an index past the end into the last chunk", () => {
		expect(new SourceText(QUOTED).point(99)).toEqual({ line: 2, column: 6, offset: 11 });
	});

	test("clamps a negative index to the first chunk's origin", () => {
		expect(new SourceText(QUOTED).point(-4)).toEqual({ line: 1, column: 3, offset: 2 });
	});

	test("answers the document start when it collected no chunks", () => {
		let text = new SourceText([]);

		expect(text.point(0)).toEqual({ line: 1, column: 1, offset: 0 });
		expect(text.point(12)).toEqual({ line: 1, column: 1, offset: 0 });
	});

	test("spans the two chunks a node written across a line break covers", () => {
		expect(new SourceText(QUOTED).position(1, 5)).toEqual({
			start: { line: 1, column: 4, offset: 3 },
			end: { line: 2, column: 4, offset: 9 },
		});
	});

	test("spans nothing when a node begins and ends at one index", () => {
		let position = new SourceText(QUOTED).position(2, 2);

		expect(position.start).toEqual(position.end);
	});
});

describe("emptyPosition", () => {
	test("reports the given point as both ends of the span", () => {
		let point = { line: 7, column: 2, offset: 40 };

		expect(emptyPosition(point)).toEqual({ start: point, end: point });
	});
});
