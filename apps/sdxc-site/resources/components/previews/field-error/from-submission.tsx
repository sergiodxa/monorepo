/**
 * Live example for a `FieldError` rendered from a submission's errors. The slot is always
 * in the markup and `hidden` follows whether the field has an error, so the control keeps
 * a stable `aria-describedby` target and the example is plain server markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { FieldError, Input, Label } from "@sdxc/ui";

/** The errors a rejected submission came back with, which decide what the slot shows. */
const ERRORS: { email?: string } = { email: "Enter a full address, like sergio@acme.com." };

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `let errors = { email: "Enter a full address, like sergio@acme.com." };

<div mix={[vstack({ gap: 2, align: "stretch" })]}>
	<Label htmlFor="email">Work email</Label>
	<Input
		id="email"
		name="email"
		type="email"
		defaultValue="sergio@acme"
		required
		aria-invalid={errors.email ? "true" : undefined}
		aria-describedby="email-error"
	/>
	<FieldError id="email-error" hidden={!errors.email}>
		{errors.email}
	</FieldError>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "From a submission's errors",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 2, align: "stretch" })]}>
			<Label htmlFor="example-field-error-from-submission-email">Work email</Label>
			<Input
				id="example-field-error-from-submission-email"
				name="email"
				type="email"
				defaultValue="sergio@acme"
				required
				aria-invalid={ERRORS.email ? "true" : undefined}
				aria-describedby="example-field-error-from-submission-email-error"
			/>
			<FieldError id="example-field-error-from-submission-email-error" hidden={!ERRORS.email}>
				{ERRORS.email}
			</FieldError>
		</div>
	),
};
