/**
 * Live example island for a composed `RangeCalendar` booking time out of office. The grid
 * renders and shows the committed range without script; paging months, walking days and
 * picking both ends run in the browser, so the island owns the model and the range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MonthGridDay } from "@sdxc/dates";
import type { Handle } from "remix/component";

import { monthGrid, systemTimeZone, toDayKey } from "@sdxc/dates";
import { fg } from "@sdxc/u/color";
import { flex, vstack } from "@sdxc/u/layout";
import { is, m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { RangeCalendar } from "@sdxc/ui";
import { CalendarModel } from "@sdxc/ui/behaviors";
import { calendarKeys } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** Column headings, in the order `monthGrid` lays a week out. */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The month the grid opens on, fixed so the server and the browser draw the same grid. */
const OPENING_MONTH = new Date(2026, 11, 21);

/** The source the page shows, matching the markup below. */
const CODE = `let timeZone = systemTimeZone();
let model = new CalendarModel({ focusedDate: OPENING_MONTH });
let range = { start: "2026-12-21", end: "2026-12-31" };

model.addEventListener("change", () => void handle.update());

function pickDay(key: string) {
	let date = parseDayKey(key);
	if (model.anchorDate === null) {
		model.beginRange(date);
		range = null;
	} else {
		let picked = model.completeRange(date);
		if (picked) range = { start: toDayKey(picked.start, timeZone), end: toDayKey(picked.end, timeZone) };
	}
	void handle.update();
}

<div mix={[vstack({ gap: 3, align: "center" })]}>
	<RangeCalendar aria-label="Out of office">
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
			]}
		>
			<RangeCalendar.GridHeader>
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
								data-outside-month={day.inMonth ? undefined : ""}
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
		{range ? \`Away from \${range.start} to \${range.end}\` : "Pick the day you are back"}
	</p>
</div>`;

/** The day a `data-date` key names, read back as the local midnight the model counts in. */
function parseDayKey(key: string): Date {
	let [year, month, day] = key.split("-").map(Number);
	return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** A month grid booking a stretch away, hydrated so paging, arrow keys and picks reach the model. */
export const RangeCalendarOutOfOffice = clientEntry(
	import.meta.url,
	function RangeCalendarOutOfOffice(handle: Handle) {
		let timeZone = systemTimeZone();
		let model = new CalendarModel({ focusedDate: OPENING_MONTH });
		let range: { start: string; end: string } | null = {
			start: "2026-12-21",
			end: "2026-12-31",
		};

		model.addEventListener("change", () => void handle.update());

		/** The first pick anchors the range and the second commits it, in either order. */
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
			let monthLabel = new Intl.DateTimeFormat("en-US", {
				month: "long",
				year: "numeric",
			}).format(model.visibleMonth);
			let focusedKey = toDayKey(model.focusedDate, timeZone);

			return (
				<div mix={[vstack({ gap: 3, align: "center" })]}>
					<RangeCalendar aria-label="Out of office">
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
							]}
						>
							<RangeCalendar.GridHeader>
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
												data-outside-month={day.inMonth ? undefined : ""}
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
						{range ? `Away from ${range.start} to ${range.end}` : "Pick the day you are back"}
					</p>
				</div>
			);
		};
	},
);

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Out of office",
	code: CODE,
	render: () => <RangeCalendarOutOfOffice />,
};
