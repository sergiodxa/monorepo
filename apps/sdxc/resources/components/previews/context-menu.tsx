/**
 * Live preview island for `ContextMenu`. The surface is a popover, so it renders closed
 * and there is nothing to see until something opens it: no markup can anchor a floating
 * surface to a pointer position, so the preview carries the same `contextMenu(id)` wiring
 * a reader would write on the trigger area, which opens the menu where the pointer is on
 * right-click and at the trigger's box from the Context Menu key. `menuKeys()` adds the
 * roving tabindex, arrows, Home/End and typeahead the menu pattern asks for. The row takes
 * a tab stop of its own, which is what gives the keyboard path somewhere to fire from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	ChevronRightIcon,
	CopyIcon,
	DownloadIcon,
	FileTextIcon,
	PencilIcon,
	Trash2Icon,
} from "@sdxc/icons";
import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, maxIs, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { ContextMenu, Item } from "@sdxc/ui";
import { contextMenu, menuKeys } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("28rem")]}>
	<p mix={[text("sm"), fg("neutral")]}>Right-click a row, or focus it and press the Context Menu key.</p>

	<ContextMenu.Trigger
		tabIndex={0}
		aria-label="q3-board-review.pdf, press the Context Menu key for actions"
		mix={[
			rounded("lg"),
			border({ color: "neutral", width: 1 }),
			p(1),
			contextMenu("preview-row-menu"),
		]}
	>
		<Item>
			<Item.Media>
				<FileTextIcon size={18} aria-hidden="true" />
			</Item.Media>
			<Item.Content>
				<Item.Title>q3-board-review.pdf</Item.Title>
				<Item.Description>2.4 MB · edited by Ana Souza · yesterday</Item.Description>
			</Item.Content>
		</Item>
	</ContextMenu.Trigger>

	<ContextMenu id="preview-row-menu" aria-label="File actions" mix={[menuKeys()]}>
		<ContextMenu.Group aria-labelledby="preview-row-menu-file">
			<ContextMenu.Label id="preview-row-menu-file">File</ContextMenu.Label>
			<ContextMenu.Item mix={[hstack({ gap: 2, align: "center" })]}>
				<PencilIcon size={16} aria-hidden="true" />
				Rename
				<ContextMenu.Shortcut>F2</ContextMenu.Shortcut>
			</ContextMenu.Item>
			<ContextMenu.Item mix={[hstack({ gap: 2, align: "center" })]}>
				<CopyIcon size={16} aria-hidden="true" />
				Duplicate
				<ContextMenu.Shortcut>⌘D</ContextMenu.Shortcut>
			</ContextMenu.Item>
			<ContextMenu.Item href="#download" mix={[hstack({ gap: 2, align: "center" })]}>
				<DownloadIcon size={16} aria-hidden="true" />
				Download
			</ContextMenu.Item>
		</ContextMenu.Group>

		<ContextMenu.Group aria-labelledby="preview-row-menu-share">
			<ContextMenu.Label id="preview-row-menu-share">Share</ContextMenu.Label>
			<ContextMenu.SubTrigger commandfor="preview-row-menu-share-surface" command="toggle-popover">
				Send a copy
				<ChevronRightIcon data-slot="icon" size={16} aria-hidden="true" />
			</ContextMenu.SubTrigger>
			<ContextMenu.CheckboxItem aria-selected="true">Anyone with the link</ContextMenu.CheckboxItem>
		</ContextMenu.Group>

		<ContextMenu.Separator />

		<ContextMenu.Item danger mix={[hstack({ gap: 2, align: "center" })]}>
			<Trash2Icon size={16} aria-hidden="true" />
			<span mix={[weight("medium")]}>Move to trash</span>
			<ContextMenu.Shortcut>⌫</ContextMenu.Shortcut>
		</ContextMenu.Item>
	</ContextMenu>

	<ContextMenu.SubContent
		id="preview-row-menu-share-surface"
		aria-label="Send a copy"
		mix={[menuKeys()]}
	>
		<ContextMenu.Item>Email</ContextMenu.Item>
		<ContextMenu.Item>Slack</ContextMenu.Item>
		<ContextMenu.Item>Copy link</ContextMenu.Item>
	</ContextMenu.SubContent>
</div>`;

/** A file row whose right-click menu opens at the pointer, hydrated so the gesture lands. */
export const ContextMenuPreview = clientEntry(
	"/resources/components/previews/context-menu.tsx#ContextMenuPreview",
	function ContextMenuPreview() {
		return () => (
			<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("28rem")]}>
				<p mix={[text("sm"), fg("neutral")]}>
					Right-click a row, or focus it and press the Context Menu key.
				</p>

				<ContextMenu.Trigger
					tabIndex={0}
					aria-label="q3-board-review.pdf, press the Context Menu key for actions"
					mix={[
						rounded("lg"),
						border({ color: "neutral", width: 1 }),
						p(1),
						contextMenu("preview-row-menu"),
					]}
				>
					<Item>
						<Item.Media>
							<FileTextIcon size={18} aria-hidden="true" />
						</Item.Media>
						<Item.Content>
							<Item.Title>q3-board-review.pdf</Item.Title>
							<Item.Description>2.4 MB · edited by Ana Souza · yesterday</Item.Description>
						</Item.Content>
					</Item>
				</ContextMenu.Trigger>

				<ContextMenu id="preview-row-menu" aria-label="File actions" mix={[menuKeys()]}>
					<ContextMenu.Group aria-labelledby="preview-row-menu-file">
						<ContextMenu.Label id="preview-row-menu-file">File</ContextMenu.Label>
						<ContextMenu.Item mix={[hstack({ gap: 2, align: "center" })]}>
							<PencilIcon size={16} aria-hidden="true" />
							Rename
							<ContextMenu.Shortcut>F2</ContextMenu.Shortcut>
						</ContextMenu.Item>
						<ContextMenu.Item mix={[hstack({ gap: 2, align: "center" })]}>
							<CopyIcon size={16} aria-hidden="true" />
							Duplicate
							<ContextMenu.Shortcut>⌘D</ContextMenu.Shortcut>
						</ContextMenu.Item>
						<ContextMenu.Item href="#download" mix={[hstack({ gap: 2, align: "center" })]}>
							<DownloadIcon size={16} aria-hidden="true" />
							Download
						</ContextMenu.Item>
					</ContextMenu.Group>

					<ContextMenu.Group aria-labelledby="preview-row-menu-share">
						<ContextMenu.Label id="preview-row-menu-share">Share</ContextMenu.Label>
						<ContextMenu.SubTrigger
							commandfor="preview-row-menu-share-surface"
							command="toggle-popover"
						>
							Send a copy
							<ChevronRightIcon data-slot="icon" size={16} aria-hidden="true" />
						</ContextMenu.SubTrigger>
						<ContextMenu.CheckboxItem aria-selected="true">
							Anyone with the link
						</ContextMenu.CheckboxItem>
					</ContextMenu.Group>

					<ContextMenu.Separator />

					<ContextMenu.Item danger mix={[hstack({ gap: 2, align: "center" })]}>
						<Trash2Icon size={16} aria-hidden="true" />
						<span mix={[weight("medium")]}>Move to trash</span>
						<ContextMenu.Shortcut>⌫</ContextMenu.Shortcut>
					</ContextMenu.Item>
				</ContextMenu>

				<ContextMenu.SubContent
					id="preview-row-menu-share-surface"
					aria-label="Send a copy"
					mix={[menuKeys()]}
				>
					<ContextMenu.Item>Email</ContextMenu.Item>
					<ContextMenu.Item>Slack</ContextMenu.Item>
					<ContextMenu.Item>Copy link</ContextMenu.Item>
				</ContextMenu.SubContent>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ContextMenuPreview /> };
