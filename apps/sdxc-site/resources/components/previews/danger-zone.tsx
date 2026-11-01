/**
 * Live preview for `DangerZone`: the end of a team's settings, with a transfer and a
 * deletion. Deleting the team is the big irreversible one, so its confirm asks for the
 * team's name and its button sits under the consequences; the short transfer keeps its
 * button at the row's end and opens on Cancel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { DangerZone } from "@sdxc/ui/app/danger-zone";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<DangerZone title="Danger zone">
	<DangerZone.Action
		id="transfer-team"
		title="Transfer ownership"
		description="Make another admin the owner of Acme Ops. You stay on as an admin."
		buttonLabel="Transfer…"
		actionPlacement="end"
		confirm={{
			title: "Transfer Acme Ops?",
			description: "Ana Ruiz becomes the owner and takes over billing.",
			confirmLabel: "Transfer ownership",
			cancelLabel: "Cancel",
			form: { action: "/teams/acme-ops/transfer" },
		}}
	/>
	<DangerZone.Action
		id="delete-team"
		title="Delete team"
		description="Permanently delete Acme Ops for everyone."
		consequences={[
			"14 monitors stop checking right away",
			"3 status pages go offline",
			"90 days of check history are deleted",
		]}
		buttonLabel="Delete team"
		confirm={{
			title: "Delete team?",
			description: "Acme Ops and everything in it are deleted. This can't be undone.",
			confirmLabel: "Delete team",
			cancelLabel: "Cancel",
			typeToConfirm: { value: "acme-ops", label: 'Type "acme-ops" to confirm', name: "confirmation" },
			form: { action: "/teams/acme-ops/delete" },
		}}
	/>
</DangerZone>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<DangerZone title="Danger zone" mix={[is("100%")]}>
			<DangerZone.Action
				id="preview-danger-transfer"
				title="Transfer ownership"
				description="Make another admin the owner of Acme Ops. You stay on as an admin."
				buttonLabel="Transfer…"
				actionPlacement="end"
				confirm={{
					title: "Transfer Acme Ops?",
					description: "Ana Ruiz becomes the owner and takes over billing.",
					confirmLabel: "Transfer ownership",
					cancelLabel: "Cancel",
					form: { action: "/examples/teams/acme-ops/transfer" },
				}}
			/>
			<DangerZone.Action
				id="preview-danger-delete"
				title="Delete team"
				description="Permanently delete Acme Ops for everyone."
				consequences={[
					"14 monitors stop checking right away",
					"3 status pages go offline",
					"90 days of check history are deleted",
				]}
				buttonLabel="Delete team"
				confirm={{
					title: "Delete team?",
					description: "Acme Ops and everything in it are deleted. This can't be undone.",
					confirmLabel: "Delete team",
					cancelLabel: "Cancel",
					typeToConfirm: {
						value: "acme-ops",
						label: 'Type "acme-ops" to confirm',
						name: "confirmation",
					},
					form: { action: "/examples/teams/acme-ops/delete" },
				}}
			/>
		</DangerZone>
	),
};
