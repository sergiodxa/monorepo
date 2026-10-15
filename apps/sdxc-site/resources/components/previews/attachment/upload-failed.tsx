/**
 * Live example for an `Attachment` whose upload failed. The `error` state tints the row
 * and the retry control sits in its actions, so the example is the markup a server
 * re-render produces after the failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FileIcon, RotateCwIcon } from "@sdxc/icons";
import { Attachment } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Attachment state="error">
	<Attachment.Media>
		<FileIcon aria-hidden="true" />
	</Attachment.Media>
	<Attachment.Content>
		<Attachment.Title>quarterly-report.pdf</Attachment.Title>
		<Attachment.Description>Upload failed. Check your connection and try again.</Attachment.Description>
	</Attachment.Content>
	<Attachment.Actions>
		<Attachment.Action aria-label="Retry uploading quarterly-report.pdf">
			<RotateCwIcon />
		</Attachment.Action>
	</Attachment.Actions>
</Attachment>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Upload failed",
	code: CODE,
	render: () => (
		<Attachment state="error">
			<Attachment.Media>
				<FileIcon aria-hidden="true" />
			</Attachment.Media>
			<Attachment.Content>
				<Attachment.Title>quarterly-report.pdf</Attachment.Title>
				<Attachment.Description>
					Upload failed. Check your connection and try again.
				</Attachment.Description>
			</Attachment.Content>
			<Attachment.Actions>
				<Attachment.Action aria-label="Retry uploading quarterly-report.pdf">
					<RotateCwIcon />
				</Attachment.Action>
			</Attachment.Actions>
		</Attachment>
	),
};
