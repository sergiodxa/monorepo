/**
 * Live preview for `SaveBar`: a monitor's edit form. Change any field and the bar slides
 * in with Discard and Save; ⌘S saves, Discard puts the form back, and leaving the page
 * asks first while changes are unsaved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Button, TextField, TextArea } from "@sdxc/ui";
import { SaveBar } from "@sdxc/ui/app/save-bar";

/** The source the page shows, matching the markup below. */
const CODE = `<form method="post" action="/monitors/api">
	<TextField label="Name" name="name" defaultValue="Public API" />
	<TextField label="URL" name="url" type="url" defaultValue="https://api.acme.dev/health" />
	<TextField label="Expected status" name="status" type="number" defaultValue="200" />
	<TextArea name="notes" aria-label="Runbook notes" defaultValue="Page #oncall-api if it stays down for 5 minutes." />
	<Button type="submit">Save monitor</Button>

	<SaveBar labels={{ message: "Unsaved changes", discard: "Discard", save: "Save", shortcut: "⌘S" }} />
</form>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<form
			method="post"
			action="/examples/monitors/api"
			mix={[vstack({ gap: 4, align: "stretch" }), is("100%")]}
		>
			<TextField label="Name" name="name" defaultValue="Public API" />
			<TextField label="URL" name="url" type="url" defaultValue="https://api.acme.dev/health" />
			<TextField label="Expected status" name="status" type="number" defaultValue="200" />
			<TextArea
				name="notes"
				aria-label="Runbook notes"
				defaultValue="Page #oncall-api if it stays down for 5 minutes."
			/>
			<div>
				<Button type="submit">Save monitor</Button>
			</div>

			<SaveBar
				labels={{ message: "Unsaved changes", discard: "Discard", save: "Save", shortcut: "⌘S" }}
			/>
		</form>
	),
};
