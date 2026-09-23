// @vitest-environment happy-dom

/**
 * Tests for {@link "./grid-list-keys"} against a real document: a grid of
 * keyed rows, one of them holding an action cell, is mounted with the mixin
 * applied and driven by the clicks and keystrokes a browser sends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/ui/test";

import { render } from "remix/ui/test";
import { afterEach, describe, expect, test } from "vitest";

import { SelectionModel } from "../behaviors/selection-model.js";

import { gridListKeys } from "./grid-list-keys.js";

/** The rows every assertion runs over, in the order the grid lays them out. */
const ROWS = ["a", "b", "c", "d"];

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/**
 * Mounts the grid with the mixin applied, marking `disabled` rows the way a
 * consumer marks a row that takes no selection, and giving row `c` the action
 * cell an inbox hangs off a row.
 */
function mountGrid(model: SelectionModel, disabled: string[] = []): RenderResult {
	mounted = render(
		<div role="grid" mix={[gridListKeys(model)]}>
			{ROWS.map((key) => (
				<div
					key={key}
					role="row"
					data-rmx-key={key}
					tabIndex={-1}
					aria-disabled={disabled.includes(key) ? "true" : undefined}
				>
					<span>Row {key}</span>
					{key === "c" ? (
						<button type="button" role="gridcell" tabIndex={-1}>
							Archive
						</button>
					) : null}
				</div>
			))}
		</div>,
	);

	return mounted;
}

/** The row carrying `key`, as a click or an assertion reaches for it. */
function row(view: RenderResult, key: string): HTMLElement {
	let node = view.$(`[data-rmx-key="${key}"]`);
	if (node === null) throw new Error(`No row for ${key}`);
	return node;
}

/** Clicks `node` the way a browser does, from the label a reader aims at. */
function click(node: Element, init: MouseEventInit = {}): void {
	let target = node.firstElementChild ?? node;
	target.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));
}

/** Sends a keystroke from whatever currently holds focus. */
function press(key: string, init: KeyboardEventInit = {}): void {
	let target = document.activeElement ?? document.body;
	target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
}

/** The selected keys, in the grid's own row order, so an assertion reads in that order. */
function selection(model: SelectionModel): string[] {
	return ROWS.filter((key) => model.isSelected(key));
}

describe(gridListKeys.name, () => {
	test("selects the row a click lands in", () => {
		let model = new SelectionModel({ keys: ROWS });
		let view = mountGrid(model);

		click(row(view, "b"));

		expect(selection(model)).toEqual(["b"]);
		expect(row(view, "b").getAttribute("aria-selected")).toBe("true");
	});

	test("deselects a selected row on the next click, as Space does", () => {
		let model = new SelectionModel({ keys: ROWS });
		let view = mountGrid(model);

		click(row(view, "b"));
		click(row(view, "b"));

		expect(selection(model)).toEqual([]);
	});

	test("hands the clicked row the tab stop and DOM focus", () => {
		let model = new SelectionModel({ keys: ROWS });
		let view = mountGrid(model);

		click(row(view, "b"));

		expect(row(view, "b").tabIndex).toBe(0);
		expect(row(view, "a").tabIndex).toBe(-1);
		expect(document.activeElement).toBe(row(view, "b"));
	});

	test("carries on from the clicked row when the arrow keys take over", () => {
		let model = new SelectionModel({ keys: ROWS });
		let view = mountGrid(model);

		click(row(view, "b"));
		press("ArrowDown");

		expect(document.activeElement).toBe(row(view, "c"));
	});

	test("spans the range from the last click when the next one is shift-clicked", () => {
		let model = new SelectionModel({ keys: ROWS });
		let view = mountGrid(model);

		click(row(view, "b"));
		click(row(view, "d"), { shiftKey: true });

		expect(selection(model)).toEqual(["b", "c", "d"]);
	});

	test("keeps one row selected at a time in single mode, as the model defines it", () => {
		let model = new SelectionModel({ mode: "single", keys: ROWS });
		let view = mountGrid(model);

		click(row(view, "b"));
		click(row(view, "c"));

		expect(selection(model)).toEqual(["c"]);
	});

	test("leaves a row the consumer disabled unselected", () => {
		let model = new SelectionModel({ keys: ROWS });
		let view = mountGrid(model, ["b"]);

		click(row(view, "b"));

		expect(selection(model)).toEqual([]);
	});

	test("leaves selection alone when the click lands in an action cell, and focuses it", () => {
		let model = new SelectionModel({ keys: ROWS });
		let view = mountGrid(model);
		let action = view.$('[role="gridcell"]');

		action?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(selection(model)).toEqual([]);
		expect(document.activeElement).toBe(action);
		expect(action?.tabIndex).toBe(0);
	});

	test("keeps a shift-click for the grid, so the press spans rows", () => {
		let model = new SelectionModel({ keys: ROWS });
		let view = mountGrid(model);
		let press = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, shiftKey: true });

		row(view, "b").firstElementChild?.dispatchEvent(press);

		expect(press.defaultPrevented).toBe(true);
	});

	test("leaves a plain press to the document, which a reader selects text with", () => {
		let model = new SelectionModel({ keys: ROWS });
		let view = mountGrid(model);
		let press = new MouseEvent("pointerdown", { bubbles: true, cancelable: true });

		row(view, "b").firstElementChild?.dispatchEvent(press);

		expect(press.defaultPrevented).toBe(false);
	});

	test("ignores a click landing between the rows", () => {
		let model = new SelectionModel({ keys: ROWS });
		let view = mountGrid(model);

		view.container.firstElementChild?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(selection(model)).toEqual([]);
	});
});
