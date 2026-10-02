/**
 * Live preview island for `DateRangePicker`. Two native date fields joined into one
 * control: the calendar, the keyboard handling and the locale are all the platform's, so
 * both ends of the range are pickable, validated and submittable before any script loads.
 * What hydration adds is the one thing the platform cannot know — that the two fields are
 * ends of the same range — which is what lets the copy beneath them count the nights.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { DateRangePicker, Description, Input, Label } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

import { parseDayValue, stayLengthHint } from "~/app/services/calendar-labels";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const DATE_RANGE_PICKER_CODE = `let checkIn = "";
let checkOut = "";

// The fields own their values; the island only reads them back, so nothing it
// renders can overwrite a date the reader picked.
function readFields(event: Event) {
	let field = event.target as HTMLInputElement;
	if (field.name === "checkIn") checkIn = field.value;
	else if (field.name === "checkOut") checkOut = field.value;
	else return;
	void handle.update();
}

<DateRangePicker mix={[on<HTMLDivElement, "change">("change", readFields)]}>
	<Label htmlFor="checkIn">Dates of stay</Label>
	<DateRangePicker.Group>
		<Input id="checkIn" type="date" name="checkIn" aria-label="Check in" />
		<Input id="checkOut" type="date" name="checkOut" aria-label="Check out" />
	</DateRangePicker.Group>
	<Description>
		{stayLengthHint(parseDayValue(checkIn), parseDayValue(checkOut))}
	</Description>
</DateRangePicker>`;

/** A booking's dates of stay, hydrated so the copy beneath counts the nights between them. */
export const DateRangePickerPreview = clientEntry(
	"/resources/components/previews/date-range-picker.tsx#DateRangePickerPreview",
	function DateRangePickerPreview(handle: Handle) {
		let checkIn = "";
		let checkOut = "";

		/**
		 * Reads whichever end of the range just changed. The fields own their values — they
		 * are the only things writing one — so the island reads rather than renders them, and
		 * nothing it does can overwrite a date the reader picked.
		 */
		function readFields(event: Event) {
			let field = event.target as HTMLInputElement;
			if (field.name === "checkIn") checkIn = field.value;
			else if (field.name === "checkOut") checkOut = field.value;
			else return;
			void handle.update();
		}

		return () => (
			<DateRangePicker
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					is("22rem"),
					on<HTMLDivElement, "change">("change", readFields),
				]}
			>
				<Label htmlFor="preview-check-in">Dates of stay</Label>
				<DateRangePicker.Group>
					<Input id="preview-check-in" type="date" name="checkIn" aria-label="Check in" />
					<Input id="preview-check-out" type="date" name="checkOut" aria-label="Check out" />
				</DateRangePicker.Group>
				<Description>{stayLengthHint(parseDayValue(checkIn), parseDayValue(checkOut))}</Description>
			</DateRangePicker>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: DATE_RANGE_PICKER_CODE, render: () => <DateRangePickerPreview /> };
