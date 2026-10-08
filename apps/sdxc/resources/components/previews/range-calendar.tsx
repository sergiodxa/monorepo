/**
 * Live preview island for `RangeCalendar`. The composed grid renders and submits without
 * script; picking a range across it is what script adds, so the preview carries the pair
 * the component is built for — `calendarKeys(model)` for arrow/Page/Home/End and pointer
 * navigation and `rangePreview(model)` for the band that follows between the two picks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MonthGridDay } from "@sdxc/dates";
import type { Handle } from "remix/component";

import { monthGrid, systemTimeZone, toDayKey } from "@sdxc/dates";
import { bg, fg } from "@sdxc/u/color";
import { flex, vstack } from "@sdxc/u/layout";
import { is, m } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";
import { RangeCalendar } from "@sdxc/ui";
import { CalendarModel } from "@sdxc/ui/behaviors";
import { calendarKeys, rangePreview } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** Column headings, written out rather than formatted so the grid renders the same everywhere. */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/** The month the picker opens on, fixed so the server and the browser lay out the same grid. */
const OPENING_MONTH = new Date(2026, 8, 14);

/** The source the page shows, matching the markup below. */
const CODE = `let timeZone = systemTimeZone();
let model = new CalendarModel({ focusedDate: OPENING_MONTH });
let range = { start: "2026-09-14", end: "2026-09-20" };

function pickDay(key: string) {
	let date = parseDayKey(key);

	if (model.anchorDate === null) {
		model.beginRange(date);
		range = null;
	} else {
		let picked = model.completeRange(date);
		range = picked ? { start: toDayKey(picked.start, timeZone), end: toDayKey(picked.end, timeZone) } : range;
	}

	void handle.update();
}

<RangeCalendar aria-label="Stay dates">
	<RangeCalendar.Header>
		<RangeCalendar.PreviousButton
			aria-label="Previous month"
			mix={[on<HTMLButtonElement, "click">("click", () => model.showPreviousMonth())]}
		/>
		<RangeCalendar.Heading>{monthLabel}</RangeCalendar.Heading>
		<RangeCalendar.NextButton
			aria-label="Next month"
			mix={[on<HTMLButtonElement, "click">("click", () => model.showNextMonth())]}
		/>
	</RangeCalendar.Header>

	<RangeCalendar.Grid
		aria-label={monthLabel}
		mix={[
			calendarKeys(model),
			rangePreview(model),
			on<HTMLTableElement, "click">("click", (event) => {
				if (!(event.target instanceof Element)) return;

				let key = event.target.closest("[data-date]")?.getAttribute("data-date");
				if (key) pickDay(key);
			}),
			on<HTMLTableElement, "keydown">("keydown", (event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				pickDay(toDayKey(model.focusedDate, timeZone));
			}),
			// RangeCalendar.Cell styles the committed range; the band the pointer
			// drags out between the two picks is the consumer's to paint.
			when("& td[data-range-preview]", [bg("brand.tint"), fg("brand.emphasis")]),
			when("& td[data-range-anchor]", [bg("brand.solid"), fg("brand.onSolid")]),
		]}
	>
		<RangeCalendar.GridHeader>
			{/* A day cell lays its own content out with flex, so each row is the flex line
			    the seven of them sit on. */}
			<RangeCalendar.Row mix={[flex()]}>
				{WEEKDAYS.map((day) => (
					<RangeCalendar.HeaderCell key={day} mix={[is(9)]}>
						{day}
					</RangeCalendar.HeaderCell>
				))}
			</RangeCalendar.Row>
		</RangeCalendar.GridHeader>

		<RangeCalendar.GridBody>
			{monthGrid(model.visibleMonth, { weekStartsOn: 0, timeZone }).map((week) => (
				<RangeCalendar.Row key={week[0]?.key} mix={[flex()]}>
					{week.map((day) => (
						<RangeCalendar.Cell
							key={day.key}
							data-date={day.key}
							data-outside-month={!day.inMonth || undefined}
							tabIndex={day.key === toDayKey(model.focusedDate, timeZone) ? 0 : -1}
							aria-selected={inRange(day) ? "true" : undefined}
							data-selection-start={day.key === range?.start ? "" : undefined}
							data-selection-end={day.key === range?.end ? "" : undefined}
						>
							{day.date.getDate()}
						</RangeCalendar.Cell>
					))}
				</RangeCalendar.Row>
			))}
		</RangeCalendar.GridBody>
	</RangeCalendar.Grid>
</RangeCalendar>`;

/** The day a `data-date` key names, read back as the local midnight the model counts in. */
function parseDayKey(key: string): Date {
	let [year, month, day] = key.split("-").map(Number);
	return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** A composed month grid picking one range, hydrated so both of its mixins have a model. */
export const RangeCalendarPreview = clientEntry(
	"/resources/components/previews/range-calendar.tsx#RangeCalendarPreview",
	function RangeCalendarPreview(handle: Handle) {
		let timeZone = systemTimeZone();
		let model = new CalendarModel({ focusedDate: OPENING_MONTH });
		let range: { start: string; end: string } | null = {
			start: "2026-09-14",
			end: "2026-09-20",
		};
		let renderedMonth = toDayKey(model.visibleMonth, timeZone);

		/**
		 * Redraws only when the model pages to another month. Hover preview is mirrored
		 * onto the cells by `rangePreview()` itself, and a render would wipe it. The
		 * model belongs to this island, so it needs no unsubscribe of its own.
		 */
		model.addEventListener("change", () => {
			let month = toDayKey(model.visibleMonth, timeZone);
			if (month === renderedMonth) return;

			renderedMonth = month;
			void handle.update();
		});

		/** First press anchors the range, second one commits it. */
		function pickDay(key: string) {
			let date = parseDayKey(key);

			if (model.anchorDate === null) {
				model.beginRange(date);
				range = null;
			} else {
				let picked = model.completeRange(date);
				if (picked)
					range = { start: toDayKey(picked.start, timeZone), end: toDayKey(picked.end, timeZone) };
			}

			void handle.update();
		}

		/** Whether a day falls inside the committed range, which is what paints the band. */
		function inRange(day: MonthGridDay): boolean {
			if (range === null) return false;
			return day.key >= range.start && day.key <= range.end;
		}

		return () => {
			let visible = model.visibleMonth;
			let monthLabel = `${MONTHS[visible.getMonth()]} ${visible.getFullYear()}`;
			let focusedKey = toDayKey(model.focusedDate, timeZone);

			return (
				<div mix={[vstack({ gap: 3, align: "center" })]}>
					<RangeCalendar aria-label="Stay dates">
						<RangeCalendar.Header>
							<RangeCalendar.PreviousButton
								aria-label="Previous month"
								mix={[
									on<HTMLButtonElement, "click">("click", () => {
										model.showPreviousMonth();
									}),
								]}
							/>
							<RangeCalendar.Heading>{monthLabel}</RangeCalendar.Heading>
							<RangeCalendar.NextButton
								aria-label="Next month"
								mix={[
									on<HTMLButtonElement, "click">("click", () => {
										model.showNextMonth();
									}),
								]}
							/>
						</RangeCalendar.Header>

						<RangeCalendar.Grid
							aria-label={monthLabel}
							mix={[
								calendarKeys(model),
								rangePreview(model),
								on<HTMLTableElement, "click">("click", (event) => {
									if (!(event.target instanceof Element)) return;

									let key = event.target.closest("[data-date]")?.getAttribute("data-date");
									if (key) pickDay(key);
								}),
								on<HTMLTableElement, "keydown">("keydown", (event) => {
									if (event.key !== "Enter" && event.key !== " ") return;
									event.preventDefault();
									pickDay(toDayKey(model.focusedDate, timeZone));
								}),
								// RangeCalendar.Cell styles the committed range; the band the pointer
								// drags out between the two picks is the consumer's to paint.
								when("& td[data-range-preview]", [bg("brand.tint"), fg("brand.emphasis")]),
								when("& td[data-range-anchor]", [bg("brand.solid"), fg("brand.onSolid")]),
							]}
						>
							<RangeCalendar.GridHeader>
								{/* A day cell lays its own content out with flex, so each row is the flex line
								    the seven of them sit on. */}
								<RangeCalendar.Row mix={[flex()]}>
									{WEEKDAYS.map((day) => (
										<RangeCalendar.HeaderCell key={day} mix={[is(9)]}>
											{day}
										</RangeCalendar.HeaderCell>
									))}
								</RangeCalendar.Row>
							</RangeCalendar.GridHeader>

							<RangeCalendar.GridBody>
								{monthGrid(visible, { weekStartsOn: 0, timeZone }).map((week) => (
									<RangeCalendar.Row key={week[0]?.key} mix={[flex()]}>
										{week.map((day) => (
											<RangeCalendar.Cell
												key={day.key}
												data-date={day.key}
												data-outside-month={!day.inMonth || undefined}
												tabIndex={day.key === focusedKey ? 0 : -1}
												aria-selected={inRange(day) ? "true" : undefined}
												data-selection-start={day.key === range?.start ? "" : undefined}
												data-selection-end={day.key === range?.end ? "" : undefined}
											>
												{day.date.getDate()}
											</RangeCalendar.Cell>
										))}
									</RangeCalendar.Row>
								))}
							</RangeCalendar.GridBody>
						</RangeCalendar.Grid>
					</RangeCalendar>

					<p mix={[m(0), text("xs"), fg("neutral.muted")]}>
						{range
							? `Checking in ${range.start}, out ${range.end}`
							: "Pick the second date to finish the range"}
					</p>
				</div>
			);
		};
	},
);

export default { code: CODE, render: () => <RangeCalendarPreview /> };
