/**
 * Live preview island for `Attachment`. The card paints each lifecycle state and
 * `Attachment.Group` scrolls a strip of them; whole-card click-through is an opt-in
 * wrapper, so the preview carries the same `attachmentTrigger()` wiring a reader would
 * write on `Attachment.Trigger`, aimed at a dialog rather than a URL so the activation is
 * visible without leaving the page. The nested download button keeps its own click.
 *
 * A title takes the `state` prop while its file is still moving, which is what the shimmer
 * across the name is keyed on, and every name stays fully opaque so the file it stands for
 * is readable at each step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	DownloadIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	ImageIcon,
	RefreshCwIcon,
	Trash2Icon,
} from "@sdxc/icons";
import { is, maxIs } from "@sdxc/u/size";
import { Attachment, Dialog } from "@sdxc/ui";
import { attachmentTrigger } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<>
	<Attachment.Group aria-label="Attachments on this message" mix={[maxIs("34rem")]}>
		<Attachment.Trigger
			commandfor="preview-attachment-dialog"
			mix={[is("17rem"), attachmentTrigger()]}
		>
			<Attachment state="done">
				<Attachment.Media>
					<FileTextIcon aria-hidden="true" />
				</Attachment.Media>
				<Attachment.Content>
					<Attachment.Title style={{ opacity: 1 }}>q3-board-review.pdf</Attachment.Title>
					<Attachment.Description>2.4 MB · 18 pages</Attachment.Description>
				</Attachment.Content>
				<Attachment.Actions>
					<Attachment.Action aria-label="Download q3-board-review.pdf">
						<DownloadIcon />
					</Attachment.Action>
				</Attachment.Actions>
			</Attachment>
		</Attachment.Trigger>

		<Attachment state="uploading" mix={[is("17rem")]}>
			<Attachment.Media>
				<ImageIcon aria-hidden="true" />
			</Attachment.Media>
			<Attachment.Content>
				<Attachment.Title state="uploading" style={{ opacity: 1 }}>launch-hero@2x.png</Attachment.Title>
				<Attachment.Description>6.1 MB · 68% uploaded</Attachment.Description>
			</Attachment.Content>
		</Attachment>

		<Attachment state="processing" mix={[is("17rem")]}>
			<Attachment.Media>
				<FileSpreadsheetIcon aria-hidden="true" />
			</Attachment.Media>
			<Attachment.Content>
				<Attachment.Title state="processing" style={{ opacity: 1 }}>renewals-2026.csv</Attachment.Title>
				<Attachment.Description>Checking 12,480 rows</Attachment.Description>
			</Attachment.Content>
		</Attachment>

		<Attachment state="error" mix={[is("17rem")]}>
			<Attachment.Media>
				<FileTextIcon aria-hidden="true" />
			</Attachment.Media>
			<Attachment.Content>
				<Attachment.Title style={{ opacity: 1 }}>contract-final.docx</Attachment.Title>
				<Attachment.Description>Over the 25 MB limit</Attachment.Description>
			</Attachment.Content>
			<Attachment.Actions>
				<Attachment.Action aria-label="Retry contract-final.docx" color="danger" variant="ghost">
					<RefreshCwIcon />
				</Attachment.Action>
				<Attachment.Action aria-label="Remove contract-final.docx" color="danger" variant="ghost">
					<Trash2Icon />
				</Attachment.Action>
			</Attachment.Actions>
		</Attachment>
	</Attachment.Group>

	<Dialog id="preview-attachment-dialog" aria-labelledby="preview-attachment-dialog-title">
		<Dialog.Header>
			<Dialog.Title id="preview-attachment-dialog-title">q3-board-review.pdf</Dialog.Title>
			<Dialog.Description>
				The card opened this. Pressing the download button inside it did not.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Close commandfor="preview-attachment-dialog" aria-label="Close" />
	</Dialog>
</>`;

/** An upload strip across every lifecycle state, hydrated so the first card's activation lands. */
export const AttachmentPreview = clientEntry(
	"/resources/components/previews/attachment.tsx#AttachmentPreview",
	function AttachmentPreview() {
		return () => (
			<>
				<Attachment.Group aria-label="Attachments on this message" mix={[maxIs("34rem")]}>
					<Attachment.Trigger
						commandfor="preview-attachment-dialog"
						mix={[is("17rem"), attachmentTrigger()]}
					>
						<Attachment state="done">
							<Attachment.Media>
								<FileTextIcon aria-hidden="true" />
							</Attachment.Media>
							<Attachment.Content>
								<Attachment.Title style={{ opacity: 1 }}>q3-board-review.pdf</Attachment.Title>
								<Attachment.Description>2.4 MB · 18 pages</Attachment.Description>
							</Attachment.Content>
							<Attachment.Actions>
								<Attachment.Action aria-label="Download q3-board-review.pdf">
									<DownloadIcon />
								</Attachment.Action>
							</Attachment.Actions>
						</Attachment>
					</Attachment.Trigger>

					<Attachment state="uploading" mix={[is("17rem")]}>
						<Attachment.Media>
							<ImageIcon aria-hidden="true" />
						</Attachment.Media>
						<Attachment.Content>
							<Attachment.Title state="uploading" style={{ opacity: 1 }}>
								launch-hero@2x.png
							</Attachment.Title>
							<Attachment.Description>6.1 MB · 68% uploaded</Attachment.Description>
						</Attachment.Content>
					</Attachment>

					<Attachment state="processing" mix={[is("17rem")]}>
						<Attachment.Media>
							<FileSpreadsheetIcon aria-hidden="true" />
						</Attachment.Media>
						<Attachment.Content>
							<Attachment.Title state="processing" style={{ opacity: 1 }}>
								renewals-2026.csv
							</Attachment.Title>
							<Attachment.Description>Checking 12,480 rows</Attachment.Description>
						</Attachment.Content>
					</Attachment>

					<Attachment state="error" mix={[is("17rem")]}>
						<Attachment.Media>
							<FileTextIcon aria-hidden="true" />
						</Attachment.Media>
						<Attachment.Content>
							<Attachment.Title style={{ opacity: 1 }}>contract-final.docx</Attachment.Title>
							<Attachment.Description>Over the 25 MB limit</Attachment.Description>
						</Attachment.Content>
						<Attachment.Actions>
							<Attachment.Action
								aria-label="Retry contract-final.docx"
								color="danger"
								variant="ghost"
							>
								<RefreshCwIcon />
							</Attachment.Action>
							<Attachment.Action
								aria-label="Remove contract-final.docx"
								color="danger"
								variant="ghost"
							>
								<Trash2Icon />
							</Attachment.Action>
						</Attachment.Actions>
					</Attachment>
				</Attachment.Group>

				<Dialog id="preview-attachment-dialog" aria-labelledby="preview-attachment-dialog-title">
					<Dialog.Header>
						<Dialog.Title id="preview-attachment-dialog-title">q3-board-review.pdf</Dialog.Title>
						<Dialog.Description>
							The card opened this. Pressing the download button inside it did not.
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Close commandfor="preview-attachment-dialog" aria-label="Close" />
				</Dialog>
			</>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <AttachmentPreview /> };
