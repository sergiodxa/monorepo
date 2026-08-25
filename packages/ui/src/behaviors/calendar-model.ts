/**
 * Headless state model for calendar grids: tracks the keyboard-focused day,
 * the visible month page, and an in-progress range selection (anchor plus
 * hover preview), leaving value storage and rendering to the consumer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypedEventTarget } from "remix/ui";

import { dispatchChange } from "../utils/dispatch-change";

const DAYS_PER_WEEK = 7;

/**
 * Prop and event-payload types for {@link CalendarModel}.
 */
export namespace CalendarModel {
	/**
	 * An inclusive start/end pair of calendar days, always normalized so
	 * `start` comes first, whatever order the two endpoints were picked in.
	 */
	export interface Range {
		start: Date;
		end: Date;
	}

	/**
	 * Constructor options for {@link CalendarModel}.
	 */
	export interface Options {
		/**
		 * Day that starts focused. Defaults to today when omitted. Only the
		 * calendar date is read; time-of-day is discarded.
		 */
		focusedDate?: Date;
		/**
		 * Earliest day the model will focus or accept as a range endpoint;
		 * navigation and range methods clamp to it.
		 */
		min?: Date;
		/**
		 * Latest day the model will focus or accept as a range endpoint;
		 * navigation and range methods clamp to it.
		 */
		max?: Date;
		/**
		 * Predicate marking individual days as unselectable (closures on a
		 * weekend, already-booked slots, …). Navigation still visits these days,
		 * so keyboard users can reach a selectable day past them.
		 */
		isDateDisabled?: (date: Date) => boolean;
	}

	/** Events dispatched by {@link CalendarModel} as its state changes. */
	export interface EventMap {
		/**
		 * Dispatched after focus, the visible month, the range anchor, or the
		 * range preview changes.
		 */
		change: Event;
	}
}

/**
 * Owns the ephemeral state around picking a date: the keyboard-focused day,
 * the visible month page, and a range's anchor plus hover preview. The chosen
 * value stays with the consumer, and every state change dispatches `"change"`.
 *
 * @example
 * let model = new CalendarModel({ focusedDate: new Date(2026, 0, 15) });
 * model.addEventListener("change", () => update());
 * model.focusNextDay();
 */
export class CalendarModel extends TypedEventTarget<CalendarModel.EventMap> {
	#focusedDate: Date;
	#visibleMonth: Date;
	#anchorDate: Date | null = null;
	#previewDate: Date | null = null;
	#min: Date | undefined;
	#max: Date | undefined;
	#isDateDisabled: ((date: Date) => boolean) | undefined;

	/**
	 * Builds the model with an initial focused day and optional selectable
	 * bounds. The visible month follows from the focused day.
	 *
	 * @param options Initial focus, selectable bounds, and disabled-day rule.
	 */
	constructor(options: CalendarModel.Options = {}) {
		super();

		this.#min = options.min ? startOfDay(options.min) : undefined;
		this.#max = options.max ? startOfDay(options.max) : undefined;
		this.#isDateDisabled = options.isDateDisabled;

		let focused = clampDate(startOfDay(options.focusedDate ?? new Date()), this.#min, this.#max);
		this.#focusedDate = focused;
		this.#visibleMonth = startOfMonth(focused);
	}

	/**
	 * The day that currently carries keyboard/roving-tabindex focus. Always
	 * a fresh `Date` instance, so callers may mutate it freely.
	 */
	get focusedDate(): Date {
		return new Date(this.#focusedDate);
	}

	/**
	 * The first day of the month page on screen. Follows focus into a new
	 * month, and moves on its own when the consumer pages the grid via
	 * {@link showMonth}/{@link showNextMonth}/{@link showPreviousMonth}.
	 */
	get visibleMonth(): Date {
		return new Date(this.#visibleMonth);
	}

	/**
	 * The first day picked while building a range, or `null` when no range
	 * selection is in progress.
	 */
	get anchorDate(): Date | null {
		return this.#anchorDate ? new Date(this.#anchorDate) : null;
	}

	/**
	 * The day currently under hover/focus while a range's second endpoint is
	 * being chosen, or `null` when there is no pending range or no day has
	 * been previewed yet.
	 */
	get previewDate(): Date | null {
		return this.#previewDate ? new Date(this.#previewDate) : null;
	}

	/**
	 * The range implied by the current anchor and preview day, normalized so
	 * `start` comes first; `null` when no range selection is in progress.
	 * Before a preview day is set it collapses to a single day on the anchor.
	 */
	get previewRange(): CalendarModel.Range | null {
		if (this.#anchorDate === null) return null;

		let end = this.#previewDate ?? this.#anchorDate;
		return this.#anchorDate <= end
			? { start: new Date(this.#anchorDate), end: new Date(end) }
			: { start: new Date(end), end: new Date(this.#anchorDate) };
	}

	/** Earliest day the model accepts, or `null` when unbounded. */
	get min(): Date | null {
		return this.#min ? new Date(this.#min) : null;
	}

	/** Latest day the model accepts, or `null` when unbounded. */
	get max(): Date | null {
		return this.#max ? new Date(this.#max) : null;
	}

	/**
	 * Moves focus to an arbitrary day, clamped to the selectable bounds, and
	 * pages the visible month to match. Suits pointer selection of a grid
	 * cell; the directional `focus*` methods own the keyboard offset math.
	 *
	 * @param date Day to focus.
	 */
	focusDate(date: Date): void {
		this.#setFocusedDate(date);
	}

	/** Moves focus one day forward (typically the ArrowRight key). */
	focusNextDay(): void {
		this.#setFocusedDate(addDays(this.#focusedDate, 1));
	}

	/** Moves focus one day back (typically the ArrowLeft key). */
	focusPreviousDay(): void {
		this.#setFocusedDate(addDays(this.#focusedDate, -1));
	}

	/** Moves focus one week forward (typically the ArrowDown key). */
	focusNextWeek(): void {
		this.#setFocusedDate(addDays(this.#focusedDate, DAYS_PER_WEEK));
	}

	/** Moves focus one week back (typically the ArrowUp key). */
	focusPreviousWeek(): void {
		this.#setFocusedDate(addDays(this.#focusedDate, -DAYS_PER_WEEK));
	}

	/**
	 * Moves focus one month forward, clamping the day of month to the
	 * target month's last day when it's shorter (typically the PageDown
	 * key).
	 */
	focusNextMonth(): void {
		this.#setFocusedDate(addMonths(this.#focusedDate, 1));
	}

	/**
	 * Moves focus one month back, clamping the day of month to the target
	 * month's last day when it's shorter (typically the PageUp key).
	 */
	focusPreviousMonth(): void {
		this.#setFocusedDate(addMonths(this.#focusedDate, -1));
	}

	/** Moves focus to the first day of the focused month (typically the Home key). */
	focusMonthStart(): void {
		this.#setFocusedDate(startOfMonth(this.#focusedDate));
	}

	/** Moves focus to the last day of the focused month (typically the End key). */
	focusMonthEnd(): void {
		this.#setFocusedDate(endOfMonth(this.#focusedDate));
	}

	/**
	 * Pages the visible month to the month containing `date`, leaving focus
	 * where it is — the focused day scrolls out of the rendered grid until
	 * focus moves again. Suits a header's month/year picker.
	 *
	 * @param date Any day within the month to display.
	 */
	showMonth(date: Date): void {
		let next = startOfMonth(date);
		if (isSameDay(next, this.#visibleMonth)) return;

		this.#visibleMonth = next;
		dispatchChange(this);
	}

	/** Pages the visible month forward by one, leaving focus where it is. */
	showNextMonth(): void {
		this.showMonth(addMonths(this.#visibleMonth, 1));
	}

	/** Pages the visible month back by one, leaving focus where it is. */
	showPreviousMonth(): void {
		this.showMonth(addMonths(this.#visibleMonth, -1));
	}

	/**
	 * Starts a range selection at `date`, clearing any preview from a
	 * previous attempt. Call this when the user picks the first endpoint
	 * (e.g. the first click in a range calendar).
	 *
	 * @param date Day to anchor the range at.
	 */
	beginRange(date: Date): void {
		this.#anchorDate = clampDate(startOfDay(date), this.#min, this.#max);
		this.#previewDate = null;
		dispatchChange(this);
	}

	/**
	 * Updates the pending second endpoint so {@link previewRange} tracks the
	 * day under hover or focus. A no-op while no range is in progress, so
	 * hover handlers can call it unconditionally.
	 *
	 * @param date Day currently under hover/focus.
	 */
	updateRangePreview(date: Date): void {
		if (this.#anchorDate === null) return;

		this.#previewDate = clampDate(startOfDay(date), this.#min, this.#max);
		dispatchChange(this);
	}

	/**
	 * Commits the range from the current anchor to `date` and clears the
	 * pending selection, returning it normalized. With no range in progress
	 * the consumer's selected value stays untouched.
	 *
	 * @param date Day chosen as the second endpoint.
	 * @returns The committed range, or `null` when there was no anchor.
	 */
	completeRange(date: Date): CalendarModel.Range | null {
		if (this.#anchorDate === null) return null;

		let end = clampDate(startOfDay(date), this.#min, this.#max);
		let range =
			this.#anchorDate <= end
				? { start: new Date(this.#anchorDate), end: new Date(end) }
				: { start: new Date(end), end: new Date(this.#anchorDate) };

		this.#anchorDate = null;
		this.#previewDate = null;
		dispatchChange(this);

		return range;
	}

	/**
	 * Abandons an in-progress range selection (e.g. on Escape or blur),
	 * leaving the consumer's selected value untouched. A no-op when no range
	 * is in progress.
	 */
	cancelRange(): void {
		if (this.#anchorDate === null && this.#previewDate === null) return;

		this.#anchorDate = null;
		this.#previewDate = null;
		dispatchChange(this);
	}

	/**
	 * Whether `date` is the day currently carrying keyboard focus.
	 *
	 * @param date Day to test.
	 */
	isFocused(date: Date): boolean {
		return isSameDay(this.#focusedDate, date);
	}

	/**
	 * Whether `date` is the anchor of an in-progress range selection.
	 *
	 * @param date Day to test.
	 */
	isRangeAnchor(date: Date): boolean {
		return this.#anchorDate !== null && isSameDay(this.#anchorDate, date);
	}

	/**
	 * Whether `date` falls within the current {@link previewRange},
	 * inclusive of both endpoints. Always `false` when no range is in
	 * progress.
	 *
	 * @param date Day to test.
	 */
	isInPreviewRange(date: Date): boolean {
		let range = this.previewRange;
		if (range === null) return false;

		let day = startOfDay(date);
		return day >= range.start && day <= range.end;
	}

	/**
	 * Whether `date` falls in the same month as {@link visibleMonth}. Useful
	 * for dimming the leading/trailing days a month grid renders from
	 * adjacent months.
	 *
	 * @param date Day to test.
	 */
	isInVisibleMonth(date: Date): boolean {
		return (
			date.getFullYear() === this.#visibleMonth.getFullYear() &&
			date.getMonth() === this.#visibleMonth.getMonth()
		);
	}

	/**
	 * Whether `date` falls outside the selectable bounds — before
	 * {@link min}, after {@link max}, or rejected by the `isDateDisabled`
	 * predicate.
	 *
	 * @param date Day to test.
	 */
	isDisabled(date: Date): boolean {
		let day = startOfDay(date);
		if (this.#min && day < this.#min) return true;
		if (this.#max && day > this.#max) return true;
		return this.#isDateDisabled?.(day) ?? false;
	}

	/**
	 * Shared by every `focus*` method: clamps to the selectable bounds, pages
	 * the visible month to match, and dispatches `"change"` only when the
	 * focused day actually moves.
	 */
	#setFocusedDate(date: Date): void {
		let next = clampDate(startOfDay(date), this.#min, this.#max);
		if (isSameDay(next, this.#focusedDate)) return;

		this.#focusedDate = next;
		this.#visibleMonth = startOfMonth(next);
		dispatchChange(this);
	}
}

/**
 * Reports whether two dates fall on the same calendar day, ignoring
 * time-of-day.
 *
 * @param a First date to compare.
 * @param b Second date to compare.
 * @returns `true` when both dates share the same year, month, and day.
 */
function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/**
 * Normalizes a date to midnight local time, discarding its time-of-day
 * component so day-level comparisons (`<`, `>`, equality) behave correctly
 * regardless of what time the input carried.
 *
 * @param date Date to normalize.
 * @returns A new `Date` at midnight on the same calendar day.
 */
function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Counts the days in a given year/month, accounting for leap years.
 *
 * @param year Full year (e.g. `2026`).
 * @param month Zero-based month index (`0` for January).
 * @returns The number of days in that month.
 */
function daysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

/**
 * Adds a whole number of days to a date. Safe across month and year
 * boundaries: the `Date` constructor rolls an overflowing day count into
 * the neighbouring month.
 *
 * @param date Date to offset.
 * @param amount Number of days to add; negative moves backward.
 * @returns A new `Date` offset by `amount` days.
 */
function addDays(date: Date, amount: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

/**
 * Adds a whole number of months to a date, clamping the day of month to the
 * target month's last day when the target month is shorter (January 31 plus
 * one month lands on February 28).
 *
 * @param date Date to offset.
 * @param amount Number of months to add; negative moves backward.
 * @returns A new `Date` offset by `amount` months.
 */
function addMonths(date: Date, amount: number): Date {
	let year = date.getFullYear();
	let month = date.getMonth() + amount;
	let day = Math.min(date.getDate(), daysInMonth(year, month));
	return new Date(year, month, day);
}

/**
 * Constrains a date to an optional `[min, max]` bound, leaving it untouched
 * when it already falls inside the bound (or when a bound is omitted).
 *
 * @param date Date to constrain.
 * @param min Earliest allowed date, or `undefined` for no lower bound.
 * @param max Latest allowed date, or `undefined` for no upper bound.
 * @returns `date`, or the nearer bound when `date` falls outside it.
 */
function clampDate(date: Date, min: Date | undefined, max: Date | undefined): Date {
	if (min && date < min) return new Date(min);
	if (max && date > max) return new Date(max);
	return date;
}
