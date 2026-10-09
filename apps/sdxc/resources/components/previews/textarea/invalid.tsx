/**
 * Live example for an invalid `TextArea` paired with its `FieldError`, as a server
 * re-renders it after a submission. `aria-invalid` and `aria-describedby` carry the whole
 * state, so the example is plain server markup that needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { FieldError, Label, TextArea } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<div mix={[vstack({ gap: 2, align: "stretch" })]}>
	<Label htmlFor="notes">Release notes</Label>
	<TextArea
		id="notes"
		name="notes"
		defaultValue="Acme 4.2 rewrites the deploy pipeline. Builds start in half the time and previews stay warm between pushes."
		aria-describedby="notes-error"
		aria-invalid="true"
	/>
	<FieldError id="notes-error">Keep release notes under 80 characters.</FieldError>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Invalid value",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 2, align: "stretch" })]}>
			<Label htmlFor="example-textarea-invalid">Release notes</Label>
			<TextArea
				id="example-textarea-invalid"
				name="notes"
				defaultValue="Acme 4.2 rewrites the deploy pipeline. Builds start in half the time and previews stay warm between pushes."
				aria-describedby="example-textarea-invalid-error"
				aria-invalid="true"
			/>
			<FieldError id="example-textarea-invalid-error">
				Keep release notes under 80 characters.
			</FieldError>
		</div>
	),
};
