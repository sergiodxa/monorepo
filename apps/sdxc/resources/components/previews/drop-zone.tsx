/**
 * Live preview island for `DropZone`. The zone is a `<label>` around a real file input, so
 * clicking it opens the picker before any script runs; the input is styled out of sight
 * through `parts.input` so the dashed surface is the only thing on screen, and it keeps
 * its focus ring because the zone's own styling keys off `:has(input:focus-visible)`.
 *
 * Dragging a file in is the part the platform does not give a `<label>`, so that is what
 * hydration adds: `dropZone()` drives a `DragSession`, highlights the surface while a
 * drag hovers it, and hands the dropped files over in a `ui:drop-files` event.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ImageIcon, XIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Button, DropZone, Empty, Header, Item } from "@sdxc/ui";
import { DragSession } from "@sdxc/ui/behaviors";
import { dropZone } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/ui";

import { formatFileSize } from "~/app/services/file-size";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const DROP_ZONE_CODE = `let session = new DragSession();
let queued: File[] = [];

function queueFiles(files: readonly File[]) {
	queued = [...queued, ...files];
	void handle.update();
}

<Header>Product photos</Header>
<DropZone
	name="photos"
	accept="image/png, image/jpeg, image/webp"
	multiple
	// The native input stays in the accessibility tree and the tab order; the
	// dashed label is what a person sees, and it draws the focus ring for both.
	parts={{ input: [visuallyHidden()] }}
	mix={[
		dropZone(session),
		on<HTMLLabelElement, "ui:drop-files">("ui:drop-files", (event) => queueFiles(event.files)),
		on<HTMLLabelElement, "change">("change", (event) => {
			let input = event.target as HTMLInputElement;
			queueFiles([...(input.files ?? [])]);
		}),
	]}
>
	<ImageIcon aria-hidden="true" />
	<span>Drag photos here, or click to browse</span>
	<span>PNG, JPEG or WebP · up to 10 MB each</span>
</DropZone>
{queued.length === 0 ? (
	<Empty>
		<Empty.Title>No photos queued</Empty.Title>
		<Empty.Description>Whatever you drop in shows up here before it uploads.</Empty.Description>
	</Empty>
) : (
	queued.map((file, index) => (
		<Item key={\`\${file.name}-\${index}\`}>
			<Item.Content>
				<Item.Title>{file.name}</Item.Title>
				<Item.Description>{formatFileSize(file.size)}</Item.Description>
			</Item.Content>
			<Item.Actions>
				<Button
					variant="ghost"
					color="neutral"
					aria-label={\`Remove \${file.name}\`}
					mix={[on<HTMLButtonElement, "click">("click", () => removeFile(index))]}
				>
					<XIcon />
				</Button>
			</Item.Actions>
		</Item>
	))
)}`;

/** A photo upload panel, hydrated so a real drag lands in the queue below it. */
export const DropZonePreview = clientEntry(
	"/resources/components/previews/drop-zone.tsx#DropZonePreview",
	function DropZonePreview(handle: Handle) {
		let session = new DragSession();
		let queued: File[] = [];

		/** Adds whatever arrived, from a drop or from the picker, to the pending queue. */
		function queueFiles(files: readonly File[]) {
			queued = [...queued, ...files];
			void handle.update();
		}

		/** Takes one file back out of the queue before anything is uploaded. */
		function removeFile(index: number) {
			queued = queued.filter((_file, position) => position !== index);
			void handle.update();
		}

		return () => (
			<div mix={[vstack({ gap: 3, align: "stretch" }), is("26rem")]}>
				<Header>Product photos</Header>
				<DropZone
					name="photos"
					accept="image/png, image/jpeg, image/webp"
					multiple
					// The native input stays in the accessibility tree and the tab order; the
					// dashed label is what a person sees, and it draws the focus ring for both.
					parts={{ input: [visuallyHidden()] }}
					mix={[
						dropZone(session),
						on<HTMLLabelElement, "ui:drop-files">("ui:drop-files", (event) =>
							queueFiles(event.files),
						),
						on<HTMLLabelElement, "change">("change", (event) => {
							let input = event.target as HTMLInputElement;
							queueFiles([...(input.files ?? [])]);
						}),
					]}
				>
					<ImageIcon aria-hidden="true" />
					<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>
						Drag photos here, or click to browse
					</span>
					<span mix={[text("xs")]}>PNG, JPEG or WebP · up to 10 MB each</span>
				</DropZone>
				{queued.length === 0 ? (
					<Empty>
						<Empty.Title>No photos queued</Empty.Title>
						<Empty.Description>
							Whatever you drop in shows up here before it uploads.
						</Empty.Description>
					</Empty>
				) : (
					<div mix={[vstack({ gap: 2, align: "stretch" })]}>
						{queued.map((file, index) => (
							<Item key={`${file.name}-${String(index)}`}>
								<Item.Content>
									<Item.Title>{file.name}</Item.Title>
									<Item.Description>{formatFileSize(file.size)}</Item.Description>
								</Item.Content>
								<Item.Actions>
									<Button
										variant="ghost"
										color="neutral"
										aria-label={`Remove ${file.name}`}
										mix={[on<HTMLButtonElement, "click">("click", () => removeFile(index))]}
									>
										<XIcon />
									</Button>
								</Item.Actions>
							</Item>
						))}
					</div>
				)}
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: DROP_ZONE_CODE, render: () => <DropZonePreview /> };
