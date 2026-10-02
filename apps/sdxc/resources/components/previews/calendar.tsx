/**
 * Live preview island for `Calendar`, composed as the month grid rather than the native
 * `<input type="date">` it falls back to, so there is a grid to move through. The
 * component draws the nav row, the weekday header and every day pill, reading each day's
 * state off its own attributes; moving across days, weeks and months is the consumer's, so
 * the preview carries the same `calendarKeys(model)` wiring and `data-date` markers a
 * reader would write, and records for itself which day the booking lands on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { text } from "@sdxc/u/typography";
import { Calendar } from "@sdxc/ui";
import { CalendarModel } from "@sdxc/ui/behaviors";
import { calendarKeys } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

import { dayKey, monthGrid } from "~/app/services/month-grid";

/** Column headings, in the order `monthGrid` lays a week out. */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The month the example opens on, fixed so the server and the browser draw the same grid. */
const OPENING_DAY = new Date(2026, 8, 15);

/** The source the page shows, matching the markup below. */
const CODE = `let model = new CalendarModel({ focusedDate: OPENING_DAY });
let selected = dayKey(OPENING_DAY);

model.addEventListener("change", () => void handle.update());

let weeks = monthGrid(model.visibleMonth);
let days = weeks.flatMap((week) => week.days);
let monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
	model.visibleMonth,
);
let focusedKey = dayKey(model.focusedDate);
let tabbable = days.find((day) => day.key === focusedKey) ?? days.find((day) => !day.outsideMonth);

<div mix={[vstack({ gap: 2, align: "start" })]}>
	<Calendar aria-label="Pick a check-in date">
		<Calendar.Header>
			<Calendar.PreviousButton
				aria-label="Previous month"
				mix={[on<HTMLButtonElement, "click">("click", () => model.showPreviousMonth())]}
			/>
			<Calendar.Heading>{monthLabel}</Calendar.Heading>
			<Calendar.NextButton
				aria-label="Next month"
				mix={[on<HTMLButtonElement, "click">("click", () => model.showNextMonth())]}
			/>
		</Calendar.Header>

		<Calendar.Grid
			aria-label={monthLabel}
			mix={[
				calendarKeys(model),
				on<HTMLTableElement, "click">("click", (event) => {
					let cell = (event.target as HTMLElement).closest("[data-date]");
					if (!(cell instanceof HTMLElement) || cell.ariaDisabled === "true") return;

					let day = days.find((candidate) => candidate.key === cell.dataset.date);
					if (day === undefined) return;

					selected = day.key;
					void handle.update();
				}),
			]}
		>
			<Calendar.GridHeader>
				<Calendar.Row>
					{WEEKDAYS.map((weekday) => (
						<Calendar.HeaderCell key={weekday}>{weekday}</Calendar.HeaderCell>
					))}
				</Calendar.Row>
			</Calendar.GridHeader>
			<Calendar.GridBody>
				{weeks.map((week) => (
					<Calendar.Row key={week.key}>
						{week.days.map((day) => (
							<Calendar.Cell
								key={day.key}
								data-date={day.key}
								tabIndex={day.key === tabbable?.key ? 0 : -1}
								aria-selected={day.key === selected ? "true" : undefined}
								aria-disabled={day.date < OPENING_DAY ? "true" : undefined}
								data-unavailable={
									day.date.getDay() === 0 || day.date.getDay() === 6 ? "" : undefined
								}
								data-outside-month={day.outsideMonth ? "" : undefined}
							>
								{day.date.getDate()}
							</Calendar.Cell>
						))}
					</Calendar.Row>
				))}
			</Calendar.GridBody>
		</Calendar.Grid>
	</Calendar>

	<p mix={[text("sm"), fg("neutral")]}>
		Check in {selected} · weekends are unavailable, earlier dates are past
	</p>
</div>`;

/**
 * A booking month grid the arrow keys walk, hydrated so every day, week and month move
 * reaches the model driving the roving focus.
 */
export const CalendarPreview = clientEntry(
	"/resources/components/previews/calendar.tsx#CalendarPreview",
	function CalendarPreview(handle: Handle) {
		let model = new CalendarModel({ focusedDate: OPENING_DAY });
		let selected = dayKey(OPENING_DAY);

		// The listener lives as long as the model, which this island owns outright.
		model.addEventListener("change", () => void handle.update());

		return () => {
			let weeks = monthGrid(model.visibleMonth);
			let days = weeks.flatMap((week) => week.days);
			let monthLabel = new Intl.DateTimeFormat("en-US", {
				month: "long",
				year: "numeric",
			}).format(model.visibleMonth);
			let focusedKey = dayKey(model.focusedDate);
			let tabbable =
				days.find((day) => day.key === focusedKey) ?? days.find((day) => !day.outsideMonth);

			return (
				<div mix={[vstack({ gap: 2, align: "start" })]}>
					<Calendar aria-label="Pick a check-in date">
						<Calendar.Header>
							<Calendar.PreviousButton
								aria-label="Previous month"
								mix={[on<HTMLButtonElement, "click">("click", () => model.showPreviousMonth())]}
							/>
							<Calendar.Heading>{monthLabel}</Calendar.Heading>
							<Calendar.NextButton
								aria-label="Next month"
								mix={[on<HTMLButtonElement, "click">("click", () => model.showNextMonth())]}
							/>
						</Calendar.Header>

						<Calendar.Grid
							aria-label={monthLabel}
							mix={[
								calendarKeys(model),
								on<HTMLTableElement, "click">("click", (event) => {
									let cell =
										event.target instanceof HTMLElement
											? event.target.closest("[data-date]")
											: null;
									if (!(cell instanceof HTMLElement) || cell.ariaDisabled === "true") return;

									let day = days.find((candidate) => candidate.key === cell.dataset.date);
									if (day === undefined) return;

									selected = day.key;
									void handle.update();
								}),
							]}
						>
							<Calendar.GridHeader>
								<Calendar.Row>
									{WEEKDAYS.map((weekday) => (
										<Calendar.HeaderCell key={weekday}>{weekday}</Calendar.HeaderCell>
									))}
								</Calendar.Row>
							</Calendar.GridHeader>
							<Calendar.GridBody>
								{weeks.map((week) => (
									<Calendar.Row key={week.key}>
										{week.days.map((day) => (
											<Calendar.Cell
												key={day.key}
												data-date={day.key}
												tabIndex={day.key === tabbable?.key ? 0 : -1}
												aria-selected={day.key === selected ? "true" : undefined}
												aria-disabled={day.date < OPENING_DAY ? "true" : undefined}
												data-unavailable={
													day.date.getDay() === 0 || day.date.getDay() === 6 ? "" : undefined
												}
												data-outside-month={day.outsideMonth ? "" : undefined}
											>
												{day.date.getDate()}
											</Calendar.Cell>
										))}
									</Calendar.Row>
								))}
							</Calendar.GridBody>
						</Calendar.Grid>
					</Calendar>

					<p mix={[text("sm"), fg("neutral")]}>
						Check in {selected} · weekends are unavailable, earlier dates are past
					</p>
				</div>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <CalendarPreview /> };
