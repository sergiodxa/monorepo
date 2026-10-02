/**
 * Day navigation for a Calendar grid: the Arrow/Page/Home/End keys and a click
 * on a day cell both move a `CalendarModel`'s focused day, which mirrors back
 * onto the grid as roving `tabindex` and DOM focus.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/component";

import type { CalendarModel } from "../behaviors/calendar-model.js";

import { DISABLED_SELECTOR } from "../utils/disabled-selector.js";

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
 * Reads a day cell's {@link CALENDAR_DAY_DATE_ATTRIBUTE} value back into the
 * local-midnight `Date` a `CalendarModel` counts in, so a clicked cell lands
 * on the same day the keyboard path moves between.
 *
 * @param key Attribute value in `YYYY-MM-DD` form, or `null` when absent.
 * @returns The day named, or `null` when `key` is missing or malformed.
 */
function fromDateKey(key: string | null): Date | null {
	if (key === null) return null;

	let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
	if (match === null) return null;

	let [, year, month, day] = match;
	return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Adds keyboard and pointer navigation to a Calendar grid: each key delegates
 * to the matching `CalendarModel` method, a click focuses the day cell it
 * lands on, and any `focusedDate` change re-syncs `tabindex` and DOM focus.
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
				on<HTMLElement, "click">("click", (event) => {
					if (!(event.target instanceof Element)) return;

					let cell = event.target.closest<HTMLElement>(`[${CALENDAR_DAY_DATE_ATTRIBUTE}]`);
					if (cell === null || cell.matches(DISABLED_SELECTOR)) return;

					let date = fromDateKey(cell.getAttribute(CALENDAR_DAY_DATE_ATTRIBUTE));
					if (date === null || model.isDisabled(date)) return;

					model.focusDate(date);
				}),
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
