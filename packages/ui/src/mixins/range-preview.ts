/**
 * Hover-and-focus range preview for a RangeCalendar grid: extends a
 * `CalendarModel`'s pending range toward whichever day cell is under the
 * pointer or focus, and mirrors the result onto the grid's day cells.
 *
 * Why JS: which cells fall between the anchor and the hovered/focused day
 * changes on every move — no static CSS selector can compute that.
 * No-JS baseline: the grid stays fully usable by click and `Tab`; only the
 * live preview band between the two picks is unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { CalendarModel } from "../behaviors/calendar-model";

import { CALENDAR_DAY_DATE_ATTRIBUTE } from "./calendar-keys";
import { trackHostNode } from "./track-host-node";

/**
 * Parses a day cell's {@link CALENDAR_DAY_DATE_ATTRIBUTE} value into a
 * `Date` built from its numeric year/month/day components, keeping the
 * parsed day at local midnight in every time zone, negative offsets included.
 *
 * @param key Attribute value in `YYYY-MM-DD` form, or `null` when absent.
 * @returns The parsed day, or `null` when `key` is missing or malformed.
 */
function parseDateKey(key: string | null): Date | null {
	if (key === null) return null;

	let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
	if (match === null) return null;

	let [, year, month, day] = match;
	return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Classifies where `date` falls within a resolved preview range, matching
 * the `data-range-preview` values the grid's styles key off: a leading
 * edge, a middle fill, a trailing edge, or a single day carrying both.
 *
 * @param date Day to classify, at local midnight.
 * @param range Normalized preview range to classify against.
 * @returns The cell's position in the range, or `null` when `date` falls outside it.
 */
function classifyRangePosition(
	date: Date,
	range: CalendarModel.Range,
): "start" | "middle" | "end" | "only" | null {
	if (date < range.start || date > range.end) return null;

	let isStart = date.getTime() === range.start.getTime();
	let isEnd = date.getTime() === range.end.getTime();
	if (isStart && isEnd) return "only";
	if (isStart) return "start";
	if (isEnd) return "end";
	return "middle";
}

/**
 * Adds hover/focus range-preview behavior to a RangeCalendar grid, extending
 * `model`'s pending range toward the hovered or focused day cell once an
 * anchor is set, and mirroring the result onto every day cell as attributes.
 *
 * @param model Calendar model already constructed by the consumer, shared
 * with any `calendarKeys()` mixin applied to the same grid.
 * @example
 * let model = new CalendarModel();
 * <div role="grid" mix={[calendarKeys(model), rangePreview(model)]} />
 */
export const rangePreview = createMixin<HTMLElement, [model: CalendarModel]>((handle) => {
	let getHostNode = trackHostNode(handle);
	let boundModel: CalendarModel | undefined;

	/** Mirrors `model`'s anchor day and preview range onto the grid's day cells. */
	function syncRangePreview(model: CalendarModel): void {
		let hostNode = getHostNode();
		if (!hostNode) return;

		let range = model.previewRange;
		let cells = hostNode.querySelectorAll<HTMLElement>(`[${CALENDAR_DAY_DATE_ATTRIBUTE}]`);

		for (let cell of cells) {
			let date = parseDateKey(cell.getAttribute(CALENDAR_DAY_DATE_ATTRIBUTE));
			if (date === null) continue;

			if (model.isRangeAnchor(date)) cell.setAttribute("data-range-anchor", "");
			else cell.removeAttribute("data-range-anchor");

			let position = range === null ? null : classifyRangePosition(date, range);
			if (position === null) cell.removeAttribute("data-range-preview");
			else cell.setAttribute("data-range-preview", position);
		}
	}

	/** Extends `model`'s pending range toward the day cell under `target`, if any. */
	function previewFromEventTarget(model: CalendarModel, target: EventTarget | null): void {
		if (!(target instanceof Element)) return;

		let cell = target.closest(`[${CALENDAR_DAY_DATE_ATTRIBUTE}]`);
		let date = parseDateKey(cell?.getAttribute(CALENDAR_DAY_DATE_ATTRIBUTE) ?? null);
		if (date === null || model.isDisabled(date)) return;

		model.updateRangePreview(date);
	}

	return (model) => {
		if (boundModel !== model) {
			boundModel = model;
			model.addEventListener("change", () => syncRangePreview(model), {
				signal: handle.signal,
			});
		}

		return createElement(handle.element, {
			mix: [
				on<HTMLElement, "pointerover">("pointerover", (event) => {
					previewFromEventTarget(model, event.target);
				}),
				on<HTMLElement, "focusin">("focusin", (event) => {
					previewFromEventTarget(model, event.target);
				}),
			],
		});
	};
});
