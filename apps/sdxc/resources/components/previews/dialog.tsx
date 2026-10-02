/**
 * Live preview island for `Dialog`. Opening and closing are the platform's: a button
 * carrying `commandfor`/`command` shows the native `<dialog>`, the close control and the
 * footer's own buttons dismiss it, and none of that needs script. What hydration adds is
 * the shortcut — `hotkey("mod+i")` opens the same dialog from anywhere on the page, which
 * is how an invite flow is reached once a team knows the app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { Button, Dialog, Keyboard, Label, Select, Text, TextArea, TextField } from "@sdxc/ui";
import { hotkey } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below. */
const DIALOG_CODE = `<Button commandfor="invite" command="show-modal">Invite people</Button>
<Text>
	Or press <Keyboard>⌘</Keyboard> <Keyboard>I</Keyboard> from anywhere.
</Text>

<Dialog id="invite" aria-labelledby="invite-title" mix={[hotkey("mod+i")]}>
	<Dialog.Header>
		<Dialog.Title id="invite-title">Invite people to Acme</Dialog.Title>
		<Dialog.Description>
			They join with the role you pick here. You can change it later from the members list.
		</Dialog.Description>
	</Dialog.Header>

	<TextField
		label="Email addresses"
		name="invites"
		type="email"
		placeholder="ana@acme.com, luis@acme.com"
		description="Separate more than one address with a comma."
		required
	/>

	<Label htmlFor="invite-role">Role</Label>
	<Select id="invite-role" name="role">
		<Select.Option value="viewer">Viewer — read everything</Select.Option>
		<Select.Option value="member" selected>
			Member — create and edit
		</Select.Option>
		<Select.Option value="admin">Admin — manage members and billing</Select.Option>
	</Select>

	<Label htmlFor="invite-note">Note</Label>
	<TextArea id="invite-note" name="note" placeholder="Anything they should know before joining." />

	<Dialog.Footer>
		<Button commandfor="invite" command="close" variant="outline" color="neutral">
			Cancel
		</Button>
		<Button commandfor="invite" command="close">Send invites</Button>
	</Dialog.Footer>
	<Dialog.Close commandfor="invite" aria-label="Close" />
</Dialog>`;

/** An invite dialog, hydrated so a keyboard shortcut reaches it as well as the button. */
export const DialogPreview = clientEntry(
	"/resources/components/previews/dialog.tsx#DialogPreview",
	function DialogPreview() {
		return () => (
			<div mix={[vstack({ gap: 3, align: "center" })]}>
				<Button commandfor="preview-dialog" command="show-modal">
					Invite people
				</Button>
				<Text>
					Or press <Keyboard>⌘</Keyboard> <Keyboard>I</Keyboard> from anywhere.
				</Text>

				<Dialog id="preview-dialog" aria-labelledby="preview-dialog-title" mix={[hotkey("mod+i")]}>
					<Dialog.Header>
						<Dialog.Title id="preview-dialog-title">Invite people to Acme</Dialog.Title>
						<Dialog.Description>
							They join with the role you pick here. You can change it later from the members list.
						</Dialog.Description>
					</Dialog.Header>

					<TextField
						label="Email addresses"
						name="invites"
						type="email"
						placeholder="ana@acme.com, luis@acme.com"
						description="Separate more than one address with a comma."
						required
					/>

					<div mix={[vstack({ gap: 2, align: "stretch" })]}>
						<Label htmlFor="preview-dialog-role">Role</Label>
						<Select id="preview-dialog-role" name="role">
							<Select.Option value="viewer">Viewer — read everything</Select.Option>
							<Select.Option value="member" selected>
								Member — create and edit
							</Select.Option>
							<Select.Option value="admin">Admin — manage members and billing</Select.Option>
						</Select>
					</div>

					<div mix={[vstack({ gap: 2, align: "stretch" })]}>
						<Label htmlFor="preview-dialog-note">Note</Label>
						<TextArea
							id="preview-dialog-note"
							name="note"
							placeholder="Anything they should know before joining."
						/>
					</div>

					<Dialog.Footer>
						<Button commandfor="preview-dialog" command="close" variant="outline" color="neutral">
							Cancel
						</Button>
						<Button commandfor="preview-dialog" command="close">
							Send invites
						</Button>
					</Dialog.Footer>
					<Dialog.Close commandfor="preview-dialog" aria-label="Close" />
				</Dialog>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: DIALOG_CODE, render: () => <DialogPreview /> };
