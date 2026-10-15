/**
 * Live example for a `DateField` bounded to one year, with a hint naming the bounds. The
 * native `min` and `max` attributes limit the platform's own picker and validation, so
 * the example works before any script loads and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DateField } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<DateField
	label="Start date"
	name="startDate"
	min="2026-01-01"
	max="2026-12-31"
	description="Your Acme plan can start on any day in 2026."
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Bounded with a hint",
	code: CODE,
	render: () => (
		<DateField
			label="Start date"
			name="startDate"
			min="2026-01-01"
			max="2026-12-31"
			description="Your Acme plan can start on any day in 2026."
		/>
	),
};
