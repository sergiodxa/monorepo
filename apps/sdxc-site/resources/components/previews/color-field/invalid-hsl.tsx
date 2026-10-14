/**
 * Live example for an `hsl` `ColorField` showing the error a submission came back with.
 * Passing `errorMessage` marks the control invalid and links the message to it, so the
 * example is the markup a server re-render produces and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ColorField } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<ColorField
	label="Theme color"
	name="themeColor"
	format="hsl"
	value="hsl(210, 90%, 55%)"
	errorMessage="White text on this color falls below a 4.5:1 contrast ratio."
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Invalid HSL value",
	code: CODE,
	render: () => (
		<ColorField
			label="Theme color"
			name="themeColor"
			format="hsl"
			value="hsl(210, 90%, 55%)"
			errorMessage="White text on this color falls below a 4.5:1 contrast ratio."
		/>
	),
};
