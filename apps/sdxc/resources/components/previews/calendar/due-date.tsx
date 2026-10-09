/**
 * Live example island for a composed `Calendar` picking an invoice's due date. The grid
 * renders without script, but paging months, walking days with the arrow keys and
 * recording a pick all run in the browser, so the island owns the model and the choice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { monthGrid, systemTimeZone, toDayKey } from "@sdxc/dates";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { text } from "@sdxc/u/typography";
import { Calendar } from "@sdxc/ui";
import { CalendarModel } from "@sdxc/ui/behaviors";
import { calendarKeys } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** Column headings, in the order `monthGrid` lays a week out. */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The due date the invoice opens on, fixed so the server and the browser draw the same grid. */
const OPENING_DAY = new Date(2026, 9, 30);

/** The source the page shows, matching the markup below. */
const CODE = `let timeZone = systemTimeZone();
let model = new CalendarModel({ focusedDate: OPENING_DAY });
let selected = toDayKey(OPENING_DAY, timeZone);

model.addEventListener("change", () => void handle.update());

let weeks = monthGrid(model.visibleMonth, { weekStartsOn: 0, timeZone });
let monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
	model.visibleMonth,
);
let focusedKey = toDayKey(model.focusedDate, timeZone);

<div mix={[vstack({ gap: 2, align: "start" })]}>
	<Calendar aria-label="Invoice due date">
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
					if (!(event.target instanceof Element)) return;
					let key = event.target.closest("[data-date]")?.getAttribute("data-date");
					if (!key) return;
					selected = key;
					void handle.update();
				}),
			]}
		>
			<Calendar.GridHeader>
				<Calendar.Row>
					{WEEKDAYS.map((day) => (
						<Calendar.HeaderCell key={day}>{day}</Calendar.HeaderCell>
					))}
				</Calendar.Row>
			</Calendar.GridHeader>
			<Calendar.GridBody>
				{weeks.map((week) => (
					<Calendar.Row key={week[0]?.key}>
						{week.map((day) => (
							<Calendar.Cell
								key={day.key}
								data-date={day.key}
								tabIndex={day.key === focusedKey ? 0 : -1}
								aria-selected={day.key === selected ? "true" : undefined}
								data-outside-month={day.inMonth ? undefined : ""}
							>
								{day.date.getDate()}
							</Calendar.Cell>
						))}
					</Calendar.Row>
				))}
			</Calendar.GridBody>
		</Calendar.Grid>
	</Calendar>

	<input type="hidden" name="dueDate" value={selected} />
	<p mix={[text("sm"), fg("neutral")]}>Invoice INV-2041 is due {selected}</p>
</div>`;

/** An invoice's due-date grid, hydrated so paging, arrow keys and picks reach the model. */
export const CalendarDueDate = clientEntry(
	import.meta.url,
	function CalendarDueDate(handle: Handle) {
		let timeZone = systemTimeZone();
		let model = new CalendarModel({ focusedDate: OPENING_DAY });
		let selected = toDayKey(OPENING_DAY, timeZone);

		model.addEventListener("change", () => void handle.update());

		return () => {
			let weeks = monthGrid(model.visibleMonth, { weekStartsOn: 0, timeZone });
			let monthLabel = new Intl.DateTimeFormat("en-US", {
				month: "long",
				year: "numeric",
			}).format(model.visibleMonth);
			let focusedKey = toDayKey(model.focusedDate, timeZone);

			return (
				<div mix={[vstack({ gap: 2, align: "start" })]}>
					<Calendar aria-label="Invoice due date">
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
									if (!(event.target instanceof Element)) return;
									let key = event.target.closest("[data-date]")?.getAttribute("data-date");
									if (!key) return;
									selected = key;
									void handle.update();
								}),
							]}
						>
							<Calendar.GridHeader>
								<Calendar.Row>
									{WEEKDAYS.map((day) => (
										<Calendar.HeaderCell key={day}>{day}</Calendar.HeaderCell>
									))}
								</Calendar.Row>
							</Calendar.GridHeader>
							<Calendar.GridBody>
								{weeks.map((week) => (
									<Calendar.Row key={week[0]?.key}>
										{week.map((day) => (
											<Calendar.Cell
												key={day.key}
												data-date={day.key}
												tabIndex={day.key === focusedKey ? 0 : -1}
												aria-selected={day.key === selected ? "true" : undefined}
												data-outside-month={day.inMonth ? undefined : ""}
											>
												{day.date.getDate()}
											</Calendar.Cell>
										))}
									</Calendar.Row>
								))}
							</Calendar.GridBody>
						</Calendar.Grid>
					</Calendar>

					<input type="hidden" name="dueDate" value={selected} />
					<p mix={[text("sm"), fg("neutral")]}>Invoice INV-2041 is due {selected}</p>
				</div>
			);
		};
	},
);

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Invoice due date",
	code: CODE,
	render: () => <CalendarDueDate />,
};
