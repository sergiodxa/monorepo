/**
 * Keyboard navigation for a Calendar grid: reads Arrow, Page, Home, and End
 * key presses and turns them into day/week/month focus movement on a
 * `CalendarModel` instance, then mirrors the model's focused day back onto
 * the grid as roving `tabindex` and native DOM focus.
 *
 * Why JS: the WAI-ARIA grid keyboard pattern moves a single logical focus
 * position across a two-dimensional grid of days using arrow, page, home,
 * and end keys, which HTML has no declarative mechanism for.
 * No-JS baseline: every day cell still renders as its own reachable cell, so
 * the grid stays fully usable one `Tab` stop at a time — only the day/week/
 * month shortcuts are unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { CalendarModel } from "../behaviors/calendar-model";

/**
 * Attribute every calendar day cell exposes its date on, in local
 * `YYYY-MM-DD` form. `calendarKeys()` reads it to find the cell that matches
 * a `CalendarModel`'s focused day so it can move roving `tabindex` and DOM
 * focus onto it.
 */
export const CALENDAR_DAY_DATE_ATTRIBUTE = "data-date";

/**
 * Formats a date as the local calendar-day key every day cell's
 * `data-date` attribute carries, so the focused day can be found in the DOM
 * by a plain string comparison instead of re-deriving `Date` equality per
 * cell.
 *
 * @param date Date to format.
 * @returns The date's local year, month, and day as `YYYY-MM-DD`.
 */
function toDateKey(date: Date): string {
	let year = String(date.getFullYear()).padStart(4, "0");
	let month = String(date.getMonth() + 1).padStart(2, "0");
	let day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Adds keyboard navigation to a Calendar grid. `ArrowUp`/`ArrowDown` move
 * focus by week, `ArrowLeft`/`ArrowRight` move it by day, `PageUp`/`PageDown`
 * move it by month, and `Home`/`End` jump to the first/last day of the
 * focused month — each key delegates to the matching `CalendarModel` method
 * rather than tracking any position itself.
 *
 * Every time the model's `focusedDate` changes — from one of these keys, or
 * from anything else that calls a `focus*` method on the same model, such as
 * a pointer click handled elsewhere — the mixin re-scans the grid's day
 * cells (identified by {@link CALENDAR_DAY_DATE_ATTRIBUTE}), sets `tabindex`
 * to `0` on the cell matching the focused day and `-1` on every other cell,
 * and moves native DOM focus onto it. This keeps roving focus consistent
 * across every element that shares the model, using the same `data-date`
 * contract the grid's own styling keys off.
 *
 * @param model Behavior class instance owning the grid's focused day, visible
 * month, and range selection state.
 * @example
 * let model = new CalendarModel();
 * <div role="grid" mix={[calendarKeys(model)]} />
 */
export const calendarKeys = createMixin<HTMLElement, [model: CalendarModel]>((handle) => {
	let hostNode: HTMLElement | undefined;
	let boundModel: CalendarModel | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
	});
	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});

	/** Mirrors `model.focusedDate` onto the grid as roving tabindex and DOM focus. */
	function syncFocusedCell(model: CalendarModel): void {
		if (!hostNode) return;

		let focusedKey = toDateKey(model.focusedDate);
		let cells = hostNode.querySelectorAll<HTMLElement>(`[${CALENDAR_DAY_DATE_ATTRIBUTE}]`);

		for (let cell of cells) {
			let isFocusedCell = cell.getAttribute(CALENDAR_DAY_DATE_ATTRIBUTE) === focusedKey;
			cell.tabIndex = isFocusedCell ? 0 : -1;

			if (isFocusedCell && document.activeElement !== cell) {
				cell.focus();
				cell.scrollIntoView({ block: "nearest", inline: "nearest" });
			}
		}
	}

	return (model) => {
		if (boundModel !== model) {
			boundModel = model;
			model.addEventListener("change", () => syncFocusedCell(model), {
				signal: handle.signal,
			});
		}

		return createElement(handle.element, {
			mix: [
				on<HTMLElement, "keydown">("keydown", (event) => {
					switch (event.key) {
						case "ArrowUp":
							event.preventDefault();
							model.focusPreviousWeek();
							return;
						case "ArrowDown":
							event.preventDefault();
							model.focusNextWeek();
							return;
						case "ArrowLeft":
							event.preventDefault();
							model.focusPreviousDay();
							return;
						case "ArrowRight":
							event.preventDefault();
							model.focusNextDay();
							return;
						case "PageUp":
							event.preventDefault();
							model.focusPreviousMonth();
							return;
						case "PageDown":
							event.preventDefault();
							model.focusNextMonth();
							return;
						case "Home":
							event.preventDefault();
							model.focusMonthStart();
							return;
						case "End":
							event.preventDefault();
							model.focusMonthEnd();
							return;
					}
				}),
			],
		});
	};
});
