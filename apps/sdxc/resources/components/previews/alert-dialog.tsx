/**
 * Live preview island for `AlertDialog`. The panel opens modally, traps focus and closes
 * only on an explicit close request, all on the platform's own `<dialog>` and Invoker
 * Commands; `method="dialog"` keeps the confirmation on the page, so the guard runs and the
 * panel closes without a navigation. The guard itself is a schema no HTML attribute can
 * express, so the field carries the same `validate(schema)` wiring a reader would write —
 * the schema a server route would parse the submission with, laid onto the field's native
 * validity and mirrored into its `FieldError` once the browser reports it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { AlertDialog, Button, Description, FieldError, Input, Label } from "@sdxc/ui";
import { validate } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";
import * as s from "remix/data-schema";

/** The name a reader has to type back before the panel will delete anything. */
const DATABASE_NAME = "acme-production";

/** The check the field is held to, the same shape a server route would parse the name with. */
const DatabaseNameSchema = s
	.string()
	.refine((typed) => typed === DATABASE_NAME, `Type ${DATABASE_NAME} exactly to confirm.`);

/** The source the page shows, matching the markup below. */
const CODE = `const DATABASE_NAME = "acme-production";

const DatabaseNameSchema = s
	.string()
	.refine((typed) => typed === DATABASE_NAME, \`Type \${DATABASE_NAME} exactly to confirm.\`);

<>
	<Button commandfor="preview-alert-dialog" command="show-modal" color="danger">
		Delete database
	</Button>

	<AlertDialog id="preview-alert-dialog" aria-labelledby="preview-alert-dialog-title">
		<form method="dialog" mix={[vstack({ gap: 5, align: "stretch" })]}>
			<AlertDialog.Header>
				<AlertDialog.Title id="preview-alert-dialog-title">
					Delete acme-production?
				</AlertDialog.Title>
				<AlertDialog.Description>
					This removes 14 GB across 38 tables, every read replica, and the last 30 days of
					point-in-time backups. Six services still hold credentials for it.
				</AlertDialog.Description>
			</AlertDialog.Header>

			<div mix={[vstack({ gap: 2, align: "stretch" })]}>
				<Label htmlFor="preview-alert-dialog-name">Database name</Label>
				<Input
					id="preview-alert-dialog-name"
					name="database"
					required
					autoComplete="off"
					placeholder={DATABASE_NAME}
					aria-describedby="preview-alert-dialog-hint preview-alert-dialog-error"
					mix={[is("100%"), validate(DatabaseNameSchema)]}
				/>
				<Description id="preview-alert-dialog-hint">
					Type the name exactly, so a deletion is never one stray click.
				</Description>
				<FieldError id="preview-alert-dialog-error" hidden />
			</div>

			<AlertDialog.Footer>
				<AlertDialog.Cancel commandfor="preview-alert-dialog">Keep it</AlertDialog.Cancel>
				<AlertDialog.Action type="submit" color="danger">
					Delete forever
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</form>
	</AlertDialog>
</>`;

/** A destructive confirmation gated on a typed name, hydrated so the schema runs as you type. */
export const AlertDialogPreview = clientEntry(
	"/resources/components/previews/alert-dialog.tsx#AlertDialogPreview",
	function AlertDialogPreview() {
		return () => (
			<>
				<Button commandfor="preview-alert-dialog" command="show-modal" color="danger">
					Delete database
				</Button>

				<AlertDialog id="preview-alert-dialog" aria-labelledby="preview-alert-dialog-title">
					<form method="dialog" mix={[vstack({ gap: 5, align: "stretch" })]}>
						<AlertDialog.Header>
							<AlertDialog.Title id="preview-alert-dialog-title">
								Delete acme-production?
							</AlertDialog.Title>
							<AlertDialog.Description>
								This removes 14 GB across 38 tables, every read replica, and the last 30 days of
								point-in-time backups. Six services still hold credentials for it.
							</AlertDialog.Description>
						</AlertDialog.Header>

						<div mix={[vstack({ gap: 2, align: "stretch" })]}>
							<Label htmlFor="preview-alert-dialog-name">Database name</Label>
							<Input
								id="preview-alert-dialog-name"
								name="database"
								required
								autoComplete="off"
								placeholder={DATABASE_NAME}
								aria-describedby="preview-alert-dialog-hint preview-alert-dialog-error"
								mix={[is("100%"), validate(DatabaseNameSchema)]}
							/>
							<Description id="preview-alert-dialog-hint">
								Type the name exactly, so a deletion is never one stray click.
							</Description>
							<FieldError id="preview-alert-dialog-error" hidden />
						</div>

						<AlertDialog.Footer>
							<AlertDialog.Cancel commandfor="preview-alert-dialog">Keep it</AlertDialog.Cancel>
							<AlertDialog.Action type="submit" color="danger">
								Delete forever
							</AlertDialog.Action>
						</AlertDialog.Footer>
					</form>
				</AlertDialog>
			</>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <AlertDialogPreview /> };
