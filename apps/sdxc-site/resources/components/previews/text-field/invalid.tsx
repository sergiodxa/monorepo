/**
 * Live example for a `TextField` showing the error a submission came back with. Passing
 * `errorMessage` marks the control invalid and links the message to it, so the example is
 * the markup a server re-render produces and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TextField } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<TextField
	label="Username"
	name="username"
	defaultValue="ab"
	errorMessage="Usernames need at least 3 characters."
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Invalid value",
	code: CODE,
	render: () => (
		<TextField
			label="Username"
			name="username"
			defaultValue="ab"
			errorMessage="Usernames need at least 3 characters."
		/>
	),
};
