/**
 * Live example island for an invalid `Group`: an email field fused to the button that
 * clears it. `aria-invalid` on the group turns any member's focus ring red, and the clear
 * button runs `clearField()`, which is the one part needing hydration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { XIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { Button, FieldError, Group, Input } from "@sdxc/ui";
import { clearField, SEARCH_FIELD_CLEAR_COMMAND } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<div mix={[vstack({ gap: 2, align: "stretch" })]}>
	<Group aria-invalid="true">
		<Input
			id="invite-email"
			name="email"
			type="email"
			defaultValue="sergio@acme"
			aria-label="Teammate's email"
			aria-invalid="true"
			aria-describedby="invite-email-error"
		/>
		<Button
			variant="outline"
			color="neutral"
			commandfor="invite-email"
			command={SEARCH_FIELD_CLEAR_COMMAND}
			aria-label="Clear the email"
			mix={[clearField()]}
		>
			<XIcon />
		</Button>
	</Group>
	<FieldError id="invite-email-error">Enter a full address, like sergio@acme.com.</FieldError>
</div>`;

/** An invite field with its clear button, hydrated so clearing empties the field. */
export const InvalidGroup = clientEntry(import.meta.url, function InvalidGroup() {
	return () => (
		<div mix={[vstack({ gap: 2, align: "stretch" })]}>
			<Group aria-invalid="true">
				<Input
					id="example-group-invalid-email"
					name="email"
					type="email"
					defaultValue="sergio@acme"
					aria-label="Teammate's email"
					aria-invalid="true"
					aria-describedby="example-group-invalid-email-error"
				/>
				<Button
					variant="outline"
					color="neutral"
					commandfor="example-group-invalid-email"
					command={SEARCH_FIELD_CLEAR_COMMAND}
					aria-label="Clear the email"
					mix={[clearField()]}
				>
					<XIcon />
				</Button>
			</Group>
			<FieldError id="example-group-invalid-email-error">
				Enter a full address, like sergio@acme.com.
			</FieldError>
		</div>
	);
});

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Invalid",
	code: CODE,
	render: () => <InvalidGroup />,
};
