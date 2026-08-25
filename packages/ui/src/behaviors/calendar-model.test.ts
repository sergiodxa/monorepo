/**
 * Unit tests for {@link CalendarModel}, constructed and driven directly:
 * every assertion reads focus/visible-month/range state or observes
 * dispatched "change" events.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { CalendarModel } from "./calendar-model";

describe(CalendarModel.name, () => {
	test("defaults to today's day, focused, with the visible month derived from it", () => {
		let today = new Date();
		let model = new CalendarModel();

		expect(model.focusedDate.getFullYear()).toBe(today.getFullYear());
		expect(model.focusedDate.getMonth()).toBe(today.getMonth());
		expect(model.focusedDate.getDate()).toBe(today.getDate());
		expect(model.visibleMonth.getFullYear()).toBe(today.getFullYear());
		expect(model.visibleMonth.getMonth()).toBe(today.getMonth());
		expect(model.visibleMonth.getDate()).toBe(1);
	});

	test("accepts an initial focused date and derives the visible month from it", () => {
		let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });

		expect(model.focusedDate).toEqual(new Date(2026, 2, 15));
		expect(model.visibleMonth).toEqual(new Date(2026, 2, 1));
	});

	test("discards the time-of-day component of the initial focused date", () => {
		let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15, 13, 45, 30) });

		expect(model.focusedDate).toEqual(new Date(2026, 2, 15));
	});

	test("clamps an initial focused date outside min/max bounds", () => {
		let model = new CalendarModel({
			focusedDate: new Date(2026, 0, 1),
			min: new Date(2026, 0, 10),
			max: new Date(2026, 0, 20),
		});

		expect(model.focusedDate).toEqual(new Date(2026, 0, 10));
	});

	test("starts with no range anchor or preview", () => {
		let model = new CalendarModel();

		expect(model.anchorDate).toBeNull();
		expect(model.previewDate).toBeNull();
		expect(model.previewRange).toBeNull();
	});

	test("returns null min/max when no bounds were provided", () => {
		let model = new CalendarModel();

		expect(model.min).toBeNull();
		expect(model.max).toBeNull();
	});

	test("exposes the min/max bounds provided at construction", () => {
		let model = new CalendarModel({
			min: new Date(2026, 0, 10),
			max: new Date(2026, 0, 20),
		});

		expect(model.min).toEqual(new Date(2026, 0, 10));
		expect(model.max).toEqual(new Date(2026, 0, 20));
	});

	test("getters return copies that cannot mutate internal state", () => {
		let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });

		let focused = model.focusedDate;
		focused.setFullYear(1999);

		expect(model.focusedDate).toEqual(new Date(2026, 2, 15));
	});

	describe("focusDate", () => {
		test("moves focus to an arbitrary day and pages the visible month to match", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });

			model.focusDate(new Date(2026, 5, 3));

			expect(model.focusedDate).toEqual(new Date(2026, 5, 3));
			expect(model.visibleMonth).toEqual(new Date(2026, 5, 1));
		});

		test("clamps to the max bound", () => {
			let model = new CalendarModel({
				focusedDate: new Date(2026, 0, 15),
				max: new Date(2026, 0, 20),
			});

			model.focusDate(new Date(2026, 1, 1));

			expect(model.focusedDate).toEqual(new Date(2026, 0, 20));
		});

		test("clamps to the min bound", () => {
			let model = new CalendarModel({
				focusedDate: new Date(2026, 0, 15),
				min: new Date(2026, 0, 10),
			});

			model.focusDate(new Date(2025, 11, 1));

			expect(model.focusedDate).toEqual(new Date(2026, 0, 10));
		});

		test("dispatches change when focus actually moves", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });
			let changeCount = 0;
			model.addEventListener("change", () => changeCount++);

			model.focusDate(new Date(2026, 2, 20));

			expect(changeCount).toBe(1);
		});

		test("does not dispatch change when focusing the day already focused", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });
			let changeCount = 0;
			model.addEventListener("change", () => changeCount++);

			model.focusDate(new Date(2026, 2, 15));

			expect(changeCount).toBe(0);
		});
	});

	describe("day and week navigation", () => {
		test("focusNextDay moves forward one day, rolling into the next month", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 0, 31) });

			model.focusNextDay();

			expect(model.focusedDate).toEqual(new Date(2026, 1, 1));
			expect(model.visibleMonth).toEqual(new Date(2026, 1, 1));
		});

		test("focusPreviousDay moves back one day, rolling into the previous month", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 1, 1) });

			model.focusPreviousDay();

			expect(model.focusedDate).toEqual(new Date(2026, 0, 31));
			expect(model.visibleMonth).toEqual(new Date(2026, 0, 1));
		});

		test("focusNextWeek moves forward seven days", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });

			model.focusNextWeek();

			expect(model.focusedDate).toEqual(new Date(2026, 2, 22));
		});

		test("focusPreviousWeek moves back seven days", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });

			model.focusPreviousWeek();

			expect(model.focusedDate).toEqual(new Date(2026, 2, 8));
		});
	});

	describe("month navigation", () => {
		test("focusNextMonth clamps the day of month to a shorter target month", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 0, 31) });

			model.focusNextMonth();

			expect(model.focusedDate).toEqual(new Date(2026, 1, 28));
		});

		test("focusPreviousMonth clamps the day of month to a shorter target month", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 31) });

			model.focusPreviousMonth();

			expect(model.focusedDate).toEqual(new Date(2026, 1, 28));
		});

		test("focusMonthStart moves focus to the 1st of the focused month", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });

			model.focusMonthStart();

			expect(model.focusedDate).toEqual(new Date(2026, 2, 1));
		});

		test("focusMonthEnd moves focus to the last day of the focused month", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 1, 5) });

			model.focusMonthEnd();

			expect(model.focusedDate).toEqual(new Date(2026, 1, 28));
		});
	});

	describe("showMonth / showNextMonth / showPreviousMonth", () => {
		test("showMonth pages the visible month without moving focus", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });

			model.showMonth(new Date(2026, 5, 1));

			expect(model.visibleMonth).toEqual(new Date(2026, 5, 1));
			expect(model.focusedDate).toEqual(new Date(2026, 2, 15));
		});

		test("showNextMonth advances the visible month by one", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });

			model.showNextMonth();

			expect(model.visibleMonth).toEqual(new Date(2026, 3, 1));
		});

		test("showPreviousMonth moves the visible month back by one", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });

			model.showPreviousMonth();

			expect(model.visibleMonth).toEqual(new Date(2026, 1, 1));
		});

		test("showMonth dispatches change when the visible month actually changes", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });
			let changeCount = 0;
			model.addEventListener("change", () => changeCount++);

			model.showNextMonth();

			expect(changeCount).toBe(1);
		});

		test("showMonth does not dispatch change when paging to the month already visible", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });
			let changeCount = 0;
			model.addEventListener("change", () => changeCount++);

			model.showMonth(new Date(2026, 2, 28));

			expect(changeCount).toBe(0);
		});
	});

	describe("range selection", () => {
		test("beginRange sets the anchor and clears any previous preview", () => {
			let model = new CalendarModel();

			model.beginRange(new Date(2026, 2, 10));

			expect(model.anchorDate).toEqual(new Date(2026, 2, 10));
			expect(model.previewDate).toBeNull();
		});

		test("previewRange collapses to a single day before a preview day is set", () => {
			let model = new CalendarModel();

			model.beginRange(new Date(2026, 2, 10));

			expect(model.previewRange).toEqual({
				start: new Date(2026, 2, 10),
				end: new Date(2026, 2, 10),
			});
		});

		test("updateRangePreview extends the preview range forward from the anchor", () => {
			let model = new CalendarModel();
			model.beginRange(new Date(2026, 2, 10));

			model.updateRangePreview(new Date(2026, 2, 15));

			expect(model.previewDate).toEqual(new Date(2026, 2, 15));
			expect(model.previewRange).toEqual({
				start: new Date(2026, 2, 10),
				end: new Date(2026, 2, 15),
			});
		});

		test("updateRangePreview normalizes the range when hovering before the anchor", () => {
			let model = new CalendarModel();
			model.beginRange(new Date(2026, 2, 10));

			model.updateRangePreview(new Date(2026, 2, 5));

			expect(model.previewRange).toEqual({
				start: new Date(2026, 2, 5),
				end: new Date(2026, 2, 10),
			});
		});

		test("updateRangePreview is a no-op without an anchor", () => {
			let model = new CalendarModel();
			let changeCount = 0;
			model.addEventListener("change", () => changeCount++);

			model.updateRangePreview(new Date(2026, 2, 5));

			expect(model.previewDate).toBeNull();
			expect(changeCount).toBe(0);
		});

		test("completeRange resolves and returns the normalized range, then clears pending state", () => {
			let model = new CalendarModel();
			model.beginRange(new Date(2026, 2, 10));
			model.updateRangePreview(new Date(2026, 2, 15));

			let range = model.completeRange(new Date(2026, 2, 20));

			expect(range).toEqual({ start: new Date(2026, 2, 10), end: new Date(2026, 2, 20) });
			expect(model.anchorDate).toBeNull();
			expect(model.previewDate).toBeNull();
			expect(model.previewRange).toBeNull();
		});

		test("completeRange normalizes when the second endpoint is before the anchor", () => {
			let model = new CalendarModel();
			model.beginRange(new Date(2026, 2, 20));

			let range = model.completeRange(new Date(2026, 2, 10));

			expect(range).toEqual({ start: new Date(2026, 2, 10), end: new Date(2026, 2, 20) });
		});

		test("completeRange returns null and dispatches nothing without an anchor", () => {
			let model = new CalendarModel();
			let changeCount = 0;
			model.addEventListener("change", () => changeCount++);

			let range = model.completeRange(new Date(2026, 2, 10));

			expect(range).toBeNull();
			expect(changeCount).toBe(0);
		});

		test("cancelRange clears the anchor and preview without committing", () => {
			let model = new CalendarModel();
			model.beginRange(new Date(2026, 2, 10));
			model.updateRangePreview(new Date(2026, 2, 15));

			model.cancelRange();

			expect(model.anchorDate).toBeNull();
			expect(model.previewDate).toBeNull();
		});

		test("cancelRange is a no-op when no range is in progress", () => {
			let model = new CalendarModel();
			let changeCount = 0;
			model.addEventListener("change", () => changeCount++);

			model.cancelRange();

			expect(changeCount).toBe(0);
		});

		test("range methods clamp endpoints to min/max bounds", () => {
			let model = new CalendarModel({
				min: new Date(2026, 2, 5),
				max: new Date(2026, 2, 25),
			});

			model.beginRange(new Date(2026, 1, 1));
			model.updateRangePreview(new Date(2026, 3, 1));
			let range = model.completeRange(new Date(2026, 3, 1));

			expect(range).toEqual({ start: new Date(2026, 2, 5), end: new Date(2026, 2, 25) });
		});
	});

	describe("query helpers", () => {
		test("isFocused reports whether a date is the focused day", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });

			expect(model.isFocused(new Date(2026, 2, 15))).toBe(true);
			expect(model.isFocused(new Date(2026, 2, 16))).toBe(false);
		});

		test("isRangeAnchor reports whether a date is the current range anchor", () => {
			let model = new CalendarModel();
			model.beginRange(new Date(2026, 2, 10));

			expect(model.isRangeAnchor(new Date(2026, 2, 10))).toBe(true);
			expect(model.isRangeAnchor(new Date(2026, 2, 11))).toBe(false);
		});

		test("isRangeAnchor is false when no range is in progress", () => {
			let model = new CalendarModel();

			expect(model.isRangeAnchor(new Date(2026, 2, 10))).toBe(false);
		});

		test("isInPreviewRange reports membership inclusive of both endpoints", () => {
			let model = new CalendarModel();
			model.beginRange(new Date(2026, 2, 10));
			model.updateRangePreview(new Date(2026, 2, 15));

			expect(model.isInPreviewRange(new Date(2026, 2, 10))).toBe(true);
			expect(model.isInPreviewRange(new Date(2026, 2, 12))).toBe(true);
			expect(model.isInPreviewRange(new Date(2026, 2, 15))).toBe(true);
			expect(model.isInPreviewRange(new Date(2026, 2, 16))).toBe(false);
			expect(model.isInPreviewRange(new Date(2026, 2, 9))).toBe(false);
		});

		test("isInPreviewRange is false when no range is in progress", () => {
			let model = new CalendarModel();

			expect(model.isInPreviewRange(new Date(2026, 2, 10))).toBe(false);
		});

		test("isInVisibleMonth reports whether a date shares the visible month", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });

			expect(model.isInVisibleMonth(new Date(2026, 2, 1))).toBe(true);
			expect(model.isInVisibleMonth(new Date(2026, 2, 31))).toBe(true);
			expect(model.isInVisibleMonth(new Date(2026, 1, 28))).toBe(false);
			expect(model.isInVisibleMonth(new Date(2026, 3, 1))).toBe(false);
		});

		test("isDisabled reflects the min/max bounds", () => {
			let model = new CalendarModel({
				min: new Date(2026, 2, 5),
				max: new Date(2026, 2, 25),
			});

			expect(model.isDisabled(new Date(2026, 2, 1))).toBe(true);
			expect(model.isDisabled(new Date(2026, 2, 26))).toBe(true);
			expect(model.isDisabled(new Date(2026, 2, 15))).toBe(false);
		});

		test("isDisabled reflects the isDateDisabled predicate", () => {
			let model = new CalendarModel({
				isDateDisabled: (date) => date.getDay() === 0 || date.getDay() === 6,
			});

			expect(model.isDisabled(new Date(2026, 2, 14))).toBe(true);
			expect(model.isDisabled(new Date(2026, 2, 16))).toBe(false);
		});

		test("navigation still reaches a day the isDateDisabled predicate rejects", () => {
			let model = new CalendarModel({
				focusedDate: new Date(2026, 2, 13),
				isDateDisabled: (date) => date.getDay() === 0 || date.getDay() === 6,
			});

			model.focusNextDay();

			expect(model.focusedDate).toEqual(new Date(2026, 2, 14));
			expect(model.isDisabled(model.focusedDate)).toBe(true);
		});
	});

	describe("event subscription lifecycle", () => {
		test("removeEventListener stops delivering change events", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });
			let changeCount = 0;
			let listener = () => changeCount++;

			model.addEventListener("change", listener);
			model.focusNextDay();
			model.removeEventListener("change", listener);
			model.focusNextDay();

			expect(changeCount).toBe(1);
		});

		test("an aborted signal detaches the change listener", () => {
			let model = new CalendarModel({ focusedDate: new Date(2026, 2, 15) });
			let controller = new AbortController();
			let changeCount = 0;

			model.addEventListener("change", () => changeCount++, { signal: controller.signal });

			model.focusNextDay();
			controller.abort();
			model.focusNextDay();

			expect(changeCount).toBe(1);
		});
	});
});
