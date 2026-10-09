/**
 * Live example for an `OtpField` holding an eight-character alphanumeric invite code.
 * `length`, `inputMode`, `autoComplete` and `pattern` reshape the one input, so the browser
 * caps, keyboards and validates it itself and the example is plain markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { Label, OtpField } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<div mix={[vstack({ gap: 2, align: "stretch" })]}>
	<Label htmlFor="invite-code">Invite code</Label>
	<OtpField
		id="invite-code"
		name="inviteCode"
		length={8}
		inputMode="text"
		autoComplete="off"
		pattern="[A-Za-z0-9]*"
	/>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Invite code",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 2, align: "stretch" })]}>
			<Label htmlFor="example-otp-field-invite-code">Invite code</Label>
			<OtpField
				id="example-otp-field-invite-code"
				name="inviteCode"
				length={8}
				inputMode="text"
				autoComplete="off"
				pattern="[A-Za-z0-9]*"
			/>
		</div>
	),
};
