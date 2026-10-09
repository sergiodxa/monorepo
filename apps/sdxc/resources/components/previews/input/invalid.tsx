/**
 * Live example for an invalid `Input` paired with its `FieldError`, as a server re-renders
 * it after a submission. `aria-invalid` and `aria-describedby` carry the whole state, so
 * the example is plain server markup that needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { FieldError, Input, Label } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<div mix={[vstack({ gap: 2, align: "stretch" })]}>
	<Label htmlFor="username">Username</Label>
	<Input
		id="username"
		name="username"
		defaultValue="acme"
		aria-describedby="username-error"
		aria-invalid="true"
	/>
	<FieldError id="username-error">That username is already taken.</FieldError>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Invalid value",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 2, align: "stretch" })]}>
			<Label htmlFor="example-input-invalid">Username</Label>
			<Input
				id="example-input-invalid"
				name="username"
				defaultValue="acme"
				aria-describedby="example-input-invalid-error"
				aria-invalid="true"
			/>
			<FieldError id="example-input-invalid-error">That username is already taken.</FieldError>
		</div>
	),
};
