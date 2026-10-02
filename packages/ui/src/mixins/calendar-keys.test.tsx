// @vitest-environment happy-dom

/**
 * Tests for {@link "./calendar-keys"} against a real document: a month grid
 * of `data-date` cells is mounted with the mixin applied, then driven by the
 * same clicks and keystrokes a browser sends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { CalendarModel } from "../behaviors/calendar-model.js";

import { calendarKeys } from "./calendar-keys.js";

/** The month every assertion runs over, fixed so a day key names the same day everywhere. */
const SEPTEMBER = [
	"2026-09-14",
	"2026-09-15",
	"2026-09-16",
	"2026-09-17",
	"2026-09-18",
	"2026-09-19",
	"2026-09-20",
];

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/**
 * Mounts one week of day cells with the mixin applied, marking `disabled`
 * keys the way a consumer marks a day it refuses to take.
 */
function mountWeek(model: CalendarModel, disabled: string[] = []): RenderResult {
	mounted = render(
		<div role="grid" mix={[calendarKeys(model)]}>
			{SEPTEMBER.map((key) => (
				<div
					key={key}
					role="gridcell"
					data-date={key}
					tabIndex={-1}
					aria-disabled={disabled.includes(key) ? "true" : undefined}
				>
					<span>{key.slice(-2)}</span>
				</div>
			))}
		</div>,
	);

	return mounted;
}

/** The cell carrying `key`, as a click or an assertion reaches for it. */
function cell(view: RenderResult, key: string): HTMLElement {
	let node = view.$(`[data-date="${key}"]`);
	if (node === null) throw new Error(`No cell for ${key}`);
	return node;
}

/** Clicks `node` the way a browser does, from whatever it holds inside. */
function click(node: Element, init: MouseEventInit = {}): void {
	let target = node.firstElementChild ?? node;
	target.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));
}

/** Sends a keystroke from the cell that currently holds focus. */
function press(key: string): void {
	let target = document.activeElement ?? document.body;
	target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

/** The day key the model is focused on, in the form a cell carries it. */
function focusedKey(model: CalendarModel): string {
	let date = model.focusedDate;
	let month = String(date.getMonth() + 1).padStart(2, "0");
	let day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

describe(calendarKeys.name, () => {
	test("moves the focused day onto the cell a click lands in", () => {
		let model = new CalendarModel({ focusedDate: new Date(2026, 8, 14) });
		let view = mountWeek(model);

		click(cell(view, "2026-09-17"));

		expect(focusedKey(model)).toBe("2026-09-17");
	});

	test("hands the clicked cell the tab stop and DOM focus the keyboard would give it", () => {
		let model = new CalendarModel({ focusedDate: new Date(2026, 8, 14) });
		let view = mountWeek(model);

		click(cell(view, "2026-09-17"));

		expect(cell(view, "2026-09-17").tabIndex).toBe(0);
		expect(cell(view, "2026-09-14").tabIndex).toBe(-1);
		expect(document.activeElement).toBe(cell(view, "2026-09-17"));
	});

	test("carries on from the clicked day when the arrow keys take over", () => {
		let model = new CalendarModel({ focusedDate: new Date(2026, 8, 14) });
		let view = mountWeek(model);

		click(cell(view, "2026-09-17"));
		press("ArrowRight");

		expect(focusedKey(model)).toBe("2026-09-18");
		expect(document.activeElement).toBe(cell(view, "2026-09-18"));
	});

	test("leaves focus where it is when a cell the consumer disabled is clicked", () => {
		let model = new CalendarModel({ focusedDate: new Date(2026, 8, 14) });
		let view = mountWeek(model, ["2026-09-17"]);

		click(cell(view, "2026-09-17"));

		expect(focusedKey(model)).toBe("2026-09-14");
	});

	test("leaves focus where it is when the model marks the clicked day unselectable", () => {
		let model = new CalendarModel({
			focusedDate: new Date(2026, 8, 14),
			isDateDisabled: (date) => date.getDate() === 17,
		});
		let view = mountWeek(model);

		click(cell(view, "2026-09-17"));

		expect(focusedKey(model)).toBe("2026-09-14");
	});

	test("leaves focus where it is when the clicked day falls past the model's bounds", () => {
		let model = new CalendarModel({
			focusedDate: new Date(2026, 8, 14),
			max: new Date(2026, 8, 16),
		});
		let view = mountWeek(model);

		click(cell(view, "2026-09-20"));

		expect(focusedKey(model)).toBe("2026-09-14");
	});

	test("ignores a click landing between the cells", () => {
		let model = new CalendarModel({ focusedDate: new Date(2026, 8, 14) });
		let view = mountWeek(model);

		view.container.firstElementChild?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(focusedKey(model)).toBe("2026-09-14");
	});
});
