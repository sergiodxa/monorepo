/**
 * Live example for an invalid `CheckboxGroup`, as a server re-renders it after a
 * submission missed a required box. The group's `aria-invalid` and `aria-describedby`
 * point at the error, so the example is plain server markup that needs no island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Checkbox, CheckboxGroup, FieldError, Label } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<CheckboxGroup aria-labelledby="terms-label" aria-invalid="true" aria-describedby="terms-error">
	<Label id="terms-label">Terms of service</Label>
	<Checkbox name="terms" value="accepted" required>
		I accept the Acme terms of service
	</Checkbox>
	<FieldError id="terms-error">Accept the terms to create your account.</FieldError>
</CheckboxGroup>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Invalid",
	code: CODE,
	render: () => (
		<CheckboxGroup
			aria-labelledby="example-checkbox-group-invalid-label"
			aria-invalid="true"
			aria-describedby="example-checkbox-group-invalid-error"
		>
			<Label id="example-checkbox-group-invalid-label">Terms of service</Label>
			<Checkbox name="terms" value="accepted" required>
				I accept the Acme terms of service
			</Checkbox>
			<FieldError id="example-checkbox-group-invalid-error">
				Accept the terms to create your account.
			</FieldError>
		</CheckboxGroup>
	),
};
