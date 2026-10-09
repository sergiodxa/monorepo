/**
 * Live preview island for `DatePicker`. The calendar is the platform's — the field is a
 * native date input, so picking a day, moving through it with the keyboard and reading the
 * month names in the reader's own locale all come from the browser and all of it works
 * before any script loads. What hydration adds is the one thing the platform has no opinion
 * about: the supporting copy under the field, which answers the day that is in it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { systemTimeZone, toDayKey } from "@sdxc/dates";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { DatePicker, Description, Input, Label } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

import { parseDayValue, relativeDayHint } from "~/app/services/calendar-labels";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const DATE_PICKER_CODE = `let today = new Date();
let value = toDayKey(today, systemTimeZone());

function readField(event: Event) {
	value = (event.target as HTMLInputElement).value;
	void handle.update();
}

<DatePicker mix={[on<HTMLDivElement, "change">("change", readField)]}>
	<Label htmlFor="startDate">Start date</Label>
	<DatePicker.Group>
		<Input id="startDate" type="date" name="startDate" defaultValue={value} />
	</DatePicker.Group>
	<Description>{relativeDayHint(parseDayValue(value), today)}</Description>
</DatePicker>`;

/** A rotation's start date, hydrated so the hint beneath answers the day the field holds. */
export const DatePickerPreview = clientEntry(
	import.meta.url,
	function DatePickerPreview(handle: Handle) {
		let today = new Date();
		let value = toDayKey(today, systemTimeZone());

		/**
		 * Reads the day back out of the field. The field owns its own value — it is the only
		 * thing writing one — so the island reads rather than renders it, and nothing it does
		 * can overwrite what the reader picked.
		 */
		function readField(event: Event) {
			value = (event.target as HTMLInputElement).value;
			void handle.update();
		}

		return () => (
			<DatePicker
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					is("18rem"),
					on<HTMLDivElement, "change">("change", readField),
				]}
			>
				<Label htmlFor="preview-start-date">Start date</Label>
				<DatePicker.Group>
					<Input
						id="preview-start-date"
						type="date"
						name="startDate"
						defaultValue={value}
						aria-describedby="preview-start-date-note"
					/>
				</DatePicker.Group>
				<Description id="preview-start-date-note">
					{relativeDayHint(parseDayValue(value), today)}
				</Description>
			</DatePicker>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: DATE_PICKER_CODE, render: () => <DatePickerPreview /> };
