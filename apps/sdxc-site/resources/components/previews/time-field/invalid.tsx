/**
 * Live example for a `TimeField` showing the error a submission came back with. Passing
 * `errorMessage` marks the control invalid and links the message to it, so the example is
 * the markup a server re-render produces and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TimeField } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<TimeField
	label="End time"
	name="endTime"
	defaultValue="09:00"
	errorMessage="The meeting ends before it starts at 10:00."
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Invalid value",
	code: CODE,
	render: () => (
		<TimeField
			label="End time"
			name="endTime"
			defaultValue="09:00"
			errorMessage="The meeting ends before it starts at 10:00."
		/>
	),
};
