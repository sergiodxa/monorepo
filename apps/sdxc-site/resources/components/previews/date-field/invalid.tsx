/**
 * Live example for a `DateField` showing the error a submission came back with. Passing
 * `errorMessage` marks the control invalid and links the message to it, so the example is
 * the markup a server re-render produces and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DateField } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<DateField
	label="Due date"
	name="dueDate"
	defaultValue="2026-07-20"
	errorMessage="Pick a due date after today."
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Invalid value",
	code: CODE,
	render: () => (
		<DateField
			label="Due date"
			name="dueDate"
			defaultValue="2026-07-20"
			errorMessage="Pick a due date after today."
		/>
	),
};
