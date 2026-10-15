/**
 * Live example for a `DatePicker` composed from its own label, group and input. The field
 * is a native date input, so the calendar, keyboard handling and locale are the
 * platform's and the example works before any script loads, with no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DatePicker, Input, Label } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<DatePicker>
	<Label htmlFor="contract-start">Contract start</Label>
	<DatePicker.Group>
		<Input id="contract-start" type="date" name="contractStart" />
	</DatePicker.Group>
</DatePicker>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Composed parts",
	code: CODE,
	render: () => (
		<DatePicker>
			<Label htmlFor="example-date-picker-composed-start">Contract start</Label>
			<DatePicker.Group>
				<Input id="example-date-picker-composed-start" type="date" name="contractStart" />
			</DatePicker.Group>
		</DatePicker>
	),
};
