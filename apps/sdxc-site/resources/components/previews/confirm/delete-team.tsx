/**
 * Live example for a type-to-confirm `Confirm`. Deleting a whole team is big and
 * irreversible, so the confirm button stays disabled until the team's name is typed;
 * routine confirms skip the field and open on Cancel instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Confirm } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<Button commandfor="delete-team" command="show-modal" color="danger" variant="outline">
	Delete team
</Button>

<Confirm
	id="delete-team"
	title="Delete team?"
	description="Acme Ops, its 14 monitors, 3 status pages and 90 days of check history are deleted for everyone."
	confirmLabel="Delete team"
	cancelLabel="Cancel"
	typeToConfirm={{ value: "acme-ops", label: 'Type "acme-ops" to confirm', name: "confirmation" }}
	form={{ action: "/examples/teams/acme-ops/delete" }}
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Type to confirm",
	code: CODE,
	render: () => (
		<>
			<Button
				commandfor="example-confirm-delete-team"
				command="show-modal"
				color="danger"
				variant="outline"
			>
				Delete team
			</Button>

			<Confirm
				id="example-confirm-delete-team"
				title="Delete team?"
				description="Acme Ops, its 14 monitors, 3 status pages and 90 days of check history are deleted for everyone."
				confirmLabel="Delete team"
				cancelLabel="Cancel"
				typeToConfirm={{
					value: "acme-ops",
					label: 'Type "acme-ops" to confirm',
					name: "confirmation",
				}}
				form={{ action: "/examples/teams/acme-ops/delete" }}
			/>
		</>
	),
};
