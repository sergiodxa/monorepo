/**
 * Live preview island for `FileTrigger`. The trigger is a `<label>` around a file input
 * that the component already styles out of sight, so the picker opens with no script and
 * the control keeps its focus ring. `mix` lands on that input, which is what lets the
 * island read the chosen file: an importer only enables its own submit once there is
 * something to import, and that check is the part the platform will not do.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { FolderIcon, UploadIcon } from "@sdxc/icons";
import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Button, Description, FileTrigger, Header, Item, Separator } from "@sdxc/ui";
import { clientEntry, on } from "remix/ui";

import { formatFileSize } from "~/app/services/file-size";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const FILE_TRIGGER_CODE = `let chosen: File | null = null;

function readChoice(event: Event & { currentTarget: HTMLInputElement }) {
	chosen = event.currentTarget.files?.[0] ?? null;
	void handle.update();
}

<Header>Import contacts</Header>

<FileTrigger
	name="contacts"
	accept=".csv,text/csv"
	mix={[on<HTMLInputElement, "change">("change", readChoice)]}
>
	<UploadIcon aria-hidden="true" />
	Choose a CSV
</FileTrigger>

<FileTrigger
	name="vcards"
	acceptDirectory
	variant="outline"
	color="neutral"
	mix={[on<HTMLInputElement, "change">("change", readChoice)]}
>
	<FolderIcon aria-hidden="true" />
	Choose a vCard folder
</FileTrigger>

<Description>
	The first row is read as the header. Columns named email and name are matched
	automatically; everything else is offered for mapping on the next step.
</Description>

<Separator />

{chosen === null ? (
	<Description>Nothing chosen yet.</Description>
) : (
	<Item>
		<Item.Content>
			<Item.Title>{chosen.name}</Item.Title>
			<Item.Description>{formatFileSize(chosen.size)}</Item.Description>
		</Item.Content>
	</Item>
)}

<Button type="submit" disabled={chosen === null}>
	Import
</Button>`;

/** A contacts importer, hydrated so the chosen file decides whether import is available. */
export const FileTriggerPreview = clientEntry(
	"/resources/components/previews/file-trigger.tsx#FileTriggerPreview",
	function FileTriggerPreview(handle: Handle) {
		let chosen: File | null = null;

		/** Reads the picked file, which is what the submit below waits for. */
		function readChoice(event: Event & { currentTarget: HTMLInputElement }) {
			chosen = event.currentTarget.files?.[0] ?? null;
			void handle.update();
		}

		return () => (
			<div mix={[vstack({ gap: 3, align: "stretch" }), is("26rem")]}>
				<Header>Import contacts</Header>

				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<FileTrigger
						name="contacts"
						accept=".csv,text/csv"
						mix={[on<HTMLInputElement, "change">("change", readChoice)]}
					>
						<UploadIcon aria-hidden="true" />
						Choose a CSV
					</FileTrigger>

					<FileTrigger
						name="vcards"
						acceptDirectory
						variant="outline"
						color="neutral"
						mix={[on<HTMLInputElement, "change">("change", readChoice)]}
					>
						<FolderIcon aria-hidden="true" />
						Choose a vCard folder
					</FileTrigger>
				</div>

				<Description>
					The first row is read as the header. Columns named email and name are matched
					automatically; everything else is offered for mapping on the next step.
				</Description>

				<Separator />

				{chosen === null ? (
					<Description>Nothing chosen yet.</Description>
				) : (
					<Item>
						<Item.Content>
							<Item.Title>{chosen.name}</Item.Title>
							<Item.Description>{formatFileSize(chosen.size)}</Item.Description>
						</Item.Content>
					</Item>
				)}

				<div mix={[hstack({ gap: 2, align: "center", justify: "end" })]}>
					<Button type="submit" disabled={chosen === null}>
						Import
					</Button>
				</div>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: FILE_TRIGGER_CODE, render: () => <FileTriggerPreview /> };
