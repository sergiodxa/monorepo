/**
 * Live example for a `TextArea` in the brand color with a placeholder, the shape a comment
 * box takes. The color sets the focus ring the browser draws, so the example is plain
 * server markup that needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TextArea } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<TextArea
	name="comment"
	aria-label="Comment"
	color="brand"
	placeholder="Leave a comment for the Acme team…"
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Brand comment box",
	code: CODE,
	render: () => (
		<TextArea
			name="comment"
			aria-label="Comment"
			color="brand"
			placeholder="Leave a comment for the Acme team…"
		/>
	),
};
