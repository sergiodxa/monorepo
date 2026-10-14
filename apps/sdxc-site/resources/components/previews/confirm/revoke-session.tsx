/**
 * Live example for a `Confirm` that submits a form. Passing `form` turns the confirm button
 * into a submit for a POST carrying the hidden fields, so confirming reaches the server
 * as a plain request and the example is markup that needs no island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Confirm } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<Button commandfor="revoke-session" command="show-modal" variant="outline" color="neutral">
	Sign out of MacBook Pro
</Button>

<Confirm
	id="revoke-session"
	title="Sign out of MacBook Pro?"
	confirmLabel="Sign out"
	cancelLabel="Stay signed in"
	form={{
		action: "/examples/settings/sessions/macbook-pro/revoke",
		fields: <input type="hidden" name="csrf" value="b1f4c9e2" />,
	}}
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Submitting a form",
	code: CODE,
	render: () => (
		<>
			<Button
				commandfor="example-confirm-revoke-session"
				command="show-modal"
				variant="outline"
				color="neutral"
			>
				Sign out of MacBook Pro
			</Button>

			<Confirm
				id="example-confirm-revoke-session"
				title="Sign out of MacBook Pro?"
				confirmLabel="Sign out"
				cancelLabel="Stay signed in"
				form={{
					action: "/examples/settings/sessions/macbook-pro/revoke",
					fields: <input type="hidden" name="csrf" value="b1f4c9e2" />,
				}}
			/>
		</>
	),
};
