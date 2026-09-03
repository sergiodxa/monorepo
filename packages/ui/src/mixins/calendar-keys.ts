/**
 * Keyboard navigation for a Calendar grid: moves day/week/month focus on a
 * `CalendarModel` from Arrow/Page/Home/End keys, then mirrors the model's
 * focused day back onto the grid as roving `tabindex` and DOM focus.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { CalendarModel } from "../behaviors/calendar-model.js";

/**
 * Attribute every calendar day cell exposes its date on, in local
 * `YYYY-MM-DD` form, that `calendarKeys()` matches against a
 * `CalendarModel`'s focused day to move roving `tabindex` and DOM focus.
 */
export const CALENDAR_DAY_DATE_ATTRIBUTE = "data-date";

/**
 * Formats a date as the local calendar-day key every day cell's
 * `data-date` attribute carries, so the focused day can be matched by a
 * plain string comparison instead of re-deriving `Date` equality per cell.
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
 * Adds keyboard navigation to a Calendar grid: each key delegates to the
 * matching `CalendarModel` method, and any `focusedDate` change — from a key
 * or another caller of the model — re-syncs roving `tabindex` and DOM focus.
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
