/**
 * Live example for an `OtpField` rejecting a code, as a server re-renders it after a failed
 * verification. `aria-invalid` and `aria-describedby` carry the whole state, so the example
 * is plain server markup that needs no island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { FieldError, Label, OtpField } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<div mix={[vstack({ gap: 2, align: "stretch" })]}>
	<Label htmlFor="otp">One-time code</Label>
	<OtpField
		id="otp"
		name="code"
		defaultValue="482913"
		aria-describedby="otp-error"
		aria-invalid="true"
	/>
	<FieldError id="otp-error">That code expired. We sent a new one to sergio@acme.com.</FieldError>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Invalid code",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 2, align: "stretch" })]}>
			<Label htmlFor="example-otp-field-invalid">One-time code</Label>
			<OtpField
				id="example-otp-field-invalid"
				name="code"
				defaultValue="482913"
				aria-describedby="example-otp-field-invalid-error"
				aria-invalid="true"
			/>
			<FieldError id="example-otp-field-invalid-error">
				That code expired. We sent a new one to sergio@acme.com.
			</FieldError>
		</div>
	),
};
