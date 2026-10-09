/**
 * Live example for a `TimeField` bounded to office hours, with a hint naming the bounds.
 * The native `min` and `max` attributes drive the platform's own validation, so the
 * example works before any script loads and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TimeField } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<TimeField
	label="Reminder time"
	name="reminderTime"
	min="09:00"
	max="18:00"
	description="Acme sends reminders between 09:00 and 18:00."
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Bounded with a hint",
	code: CODE,
	render: () => (
		<TimeField
			label="Reminder time"
			name="reminderTime"
			min="09:00"
			max="18:00"
			description="Acme sends reminders between 09:00 and 18:00."
		/>
	),
};
