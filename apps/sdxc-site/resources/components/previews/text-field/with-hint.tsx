/**
 * Live example for a `TextField` with a description. The wrapper links the hint to the
 * control through `aria-describedby` itself, so the example is plain server markup that
 * needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TextField } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<TextField
	label="Password"
	type="password"
	name="password"
	autoComplete="new-password"
	description="Use at least 12 characters, mixing letters and numbers."
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "With a hint",
	code: CODE,
	render: () => (
		<TextField
			label="Password"
			type="password"
			name="password"
			autoComplete="new-password"
			description="Use at least 12 characters, mixing letters and numbers."
		/>
	),
};
