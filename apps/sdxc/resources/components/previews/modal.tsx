/**
 * Live preview island for `Modal`. The panel opens and closes through Invoker Commands
 * on the native `<dialog>`, so the preview shows what an app actually puts inside one —
 * a titled, described form with its own fields, a close affordance in the corner and a
 * cancel/confirm footer — plus `hotkey("mod+i")`, which needs script to reach the panel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Button, Description, Input, Keyboard, Label, Modal } from "@sdxc/ui";
import { hotkey } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `<Button commandfor="invite-modal" command="show-modal">Invite members</Button>
<p mix={[m(0), text("xs"), fg("neutral.muted")]}>
	or press <Keyboard>⌘I</Keyboard>
</p>

<Modal id="invite-modal" aria-labelledby="invite-modal-title" mix={[hotkey("mod+i")]}>
	<Modal.Header>
		<Modal.Title id="invite-modal-title">Invite members</Modal.Title>
		<Modal.Description>
			They will get an email with a link that expires in seven days.
		</Modal.Description>
	</Modal.Header>

	<form
		id="invite-form"
		method="post"
		action="/members/invite"
		mix={[vstack({ gap: 4, align: "stretch" })]}
	>
		<div mix={[vstack({ gap: 2, align: "stretch" })]}>
			<Label htmlFor="invite-emails">Email addresses</Label>
			<Input
				id="invite-emails"
				name="emails"
				type="text"
				placeholder="ana@example.com, sergio@example.com"
				aria-describedby="invite-emails-hint"
			/>
			<Description id="invite-emails-hint">Separate several addresses with commas.</Description>
		</div>

		<div mix={[vstack({ gap: 2, align: "stretch" })]}>
			<Label htmlFor="invite-note">Note</Label>
			<Input id="invite-note" name="note" placeholder="Optional message" />
		</div>
	</form>

	<Modal.Footer>
		<Button commandfor="invite-modal" command="close" color="neutral" variant="outline">
			Cancel
		</Button>
		<Button type="submit" form="invite-form">
			Send invites
		</Button>
	</Modal.Footer>

	{/* The corner close is positioned rather than laid out, so it sits last and opening
	    the panel lands on the first field instead of on a dismissal. */}
	<Modal.Close commandfor="invite-modal" aria-label="Close" />
</Modal>`;

/** An invite dialog, hydrated so the keyboard shortcut can open it from anywhere on the page. */
export const ModalPreview = clientEntry(
	"/resources/components/previews/modal.tsx#ModalPreview",
	function ModalPreview() {
		return () => (
			<div mix={[vstack({ gap: 2, align: "center" })]}>
				<Button commandfor="preview-invite-modal" command="show-modal">
					Invite members
				</Button>
				<p mix={[m(0), text("xs"), fg("neutral.muted")]}>
					or press <Keyboard>⌘I</Keyboard>
				</p>

				<Modal
					id="preview-invite-modal"
					aria-labelledby="preview-invite-modal-title"
					mix={[hotkey("mod+i")]}
				>
					<Modal.Header>
						<Modal.Title id="preview-invite-modal-title">Invite members</Modal.Title>
						<Modal.Description>
							They will get an email with a link that expires in seven days.
						</Modal.Description>
					</Modal.Header>

					<form
						id="preview-invite-form"
						method="post"
						action="/members/invite"
						mix={[vstack({ gap: 4, align: "stretch" })]}
					>
						<div mix={[vstack({ gap: 2, align: "stretch" })]}>
							<Label htmlFor="preview-invite-emails">Email addresses</Label>
							<Input
								id="preview-invite-emails"
								name="emails"
								type="text"
								placeholder="ana@example.com, sergio@example.com"
								aria-describedby="preview-invite-emails-hint"
							/>
							<Description id="preview-invite-emails-hint">
								Separate several addresses with commas.
							</Description>
						</div>

						<div mix={[vstack({ gap: 2, align: "stretch" })]}>
							<Label htmlFor="preview-invite-note">Note</Label>
							<Input id="preview-invite-note" name="note" placeholder="Optional message" />
						</div>
					</form>

					<Modal.Footer>
						<Button
							commandfor="preview-invite-modal"
							command="close"
							color="neutral"
							variant="outline"
						>
							Cancel
						</Button>
						<Button type="submit" form="preview-invite-form">
							Send invites
						</Button>
					</Modal.Footer>

					{/* The corner close is positioned rather than laid out, so it sits last and
					    opening the panel lands on the first field instead of on a dismissal. */}
					<Modal.Close commandfor="preview-invite-modal" aria-label="Close" />
				</Modal>
			</div>
		);
	},
);

export default { code: CODE, render: () => <ModalPreview /> };
