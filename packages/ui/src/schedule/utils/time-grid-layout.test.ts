/**
 * Holds the time grid's layouts to their contract: overlapping events split their cluster into
 * columns and widen into free ones, separate clusters keep their own widths, and all-day spans
 * stack into the fewest rows with the longest on top.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { layoutSpanItems, layoutTimedItems } from "./time-grid-layout.js";

describe("layoutTimedItems", () => {
	test("gives an event alone the whole width", () => {
		expect(layoutTimedItems([{ id: "a", start: 540, end: 600 }]).get("a")).toEqual({
			column: 0,
			columns: 1,
			span: 1,
		});
	});

	test("splits two overlapping events into two columns, the earlier on the left", () => {
		let layout = layoutTimedItems([
			{ id: "b", start: 570, end: 630 },
			{ id: "a", start: 540, end: 600 },
		]);
		expect(layout.get("a")).toEqual({ column: 0, columns: 2, span: 1 });
		expect(layout.get("b")).toEqual({ column: 1, columns: 2, span: 1 });
	});

	test("reuses a column once its event ends, and widens an event into a free column", () => {
		let layout = layoutTimedItems([
			{ id: "long", start: 540, end: 720 },
			{ id: "first", start: 540, end: 600 },
			{ id: "second", start: 600, end: 660 },
			{ id: "third", start: 610, end: 640 },
		]);
		expect(layout.get("long")).toEqual({ column: 0, columns: 3, span: 1 });
		expect(layout.get("first")).toEqual({ column: 1, columns: 3, span: 2 });
		expect(layout.get("second")).toEqual({ column: 1, columns: 3, span: 1 });
		expect(layout.get("third")).toEqual({ column: 2, columns: 3, span: 1 });
	});

	test("keeps back-to-back events in their own clusters at full width", () => {
		let layout = layoutTimedItems([
			{ id: "a", start: 540, end: 600 },
			{ id: "b", start: 600, end: 660 },
		]);
		expect(layout.get("a")?.columns).toBe(1);
		expect(layout.get("b")?.columns).toBe(1);
	});

	test("sets two events at the same instant side by side, zero-length ones included", () => {
		let layout = layoutTimedItems([
			{ id: "a", start: 540, end: 540 },
			{ id: "b", start: 540, end: 540 },
		]);
		expect(layout.get("a")?.columns).toBe(2);
		expect(layout.get("b")?.column).toBe(1);
	});
});

describe("layoutSpanItems", () => {
	test("stacks overlapping spans and shares a row between spans that never meet", () => {
		let { rows, count } = layoutSpanItems([
			{ id: "trip", first: 1, last: 4 },
			{ id: "holiday", first: 0, last: 0 },
			{ id: "launch", first: 2, last: 2 },
			{ id: "offsite", first: 5, last: 6 },
		]);
		expect(count).toBe(2);
		expect(rows.get("holiday")).toBe(0);
		expect(rows.get("trip")).toBe(0);
		expect(rows.get("launch")).toBe(1);
		expect(rows.get("offsite")).toBe(0);
	});

	test("puts the longer of two spans starting the same day on top", () => {
		let { rows } = layoutSpanItems([
			{ id: "short", first: 0, last: 0 },
			{ id: "long", first: 0, last: 3 },
		]);
		expect(rows.get("long")).toBe(0);
		expect(rows.get("short")).toBe(1);
	});
});
