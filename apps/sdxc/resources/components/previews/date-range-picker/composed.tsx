/**
 * Live example for a `DateRangePicker` composed from a label and two native date inputs
 * in one group. Each end is the platform's own date control, so both are pickable and
 * submittable before any script loads and the example needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DateRangePicker, Input, Label } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<DateRangePicker>
	<Label htmlFor="trip-start">Trip dates</Label>
	<DateRangePicker.Group>
		<Input id="trip-start" type="date" name="tripStart" aria-label="Departure" />
		<Input id="trip-end" type="date" name="tripEnd" aria-label="Return" />
	</DateRangePicker.Group>
</DateRangePicker>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Composed parts",
	code: CODE,
	render: () => (
		<DateRangePicker>
			<Label htmlFor="example-date-range-picker-composed-start">Trip dates</Label>
			<DateRangePicker.Group>
				<Input
					id="example-date-range-picker-composed-start"
					type="date"
					name="tripStart"
					aria-label="Departure"
				/>
				<Input
					id="example-date-range-picker-composed-end"
					type="date"
					name="tripEnd"
					aria-label="Return"
				/>
			</DateRangePicker.Group>
		</DateRangePicker>
	),
};
