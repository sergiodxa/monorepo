/**
 * Live preview island for `Menubar`. Every trigger opens its own Menu through the
 * Popover API without script; the menubar pattern — one tab stop for the whole row,
 * left/right between triggers, and focus handed into whichever Menu opens — is what
 * `menubarKeys()` adds, paired with `menuKeys()` on each surface it hands off to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { grow } from "@sdxc/u/layout";
import { Keyboard, Menu, Menubar } from "@sdxc/ui";
import { menuKeys, menubarKeys } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `<Menubar aria-label="Editor" mix={[menubarKeys()]}>
	<Menubar.Trigger commandfor="file-menu">File</Menubar.Trigger>
	<Menu id="file-menu" aria-label="File" placement="bottom" mix={[menuKeys()]}>
		<Menu.Item>
			<span mix={[grow()]}>New document</span>
			<Keyboard>⌘N</Keyboard>
		</Menu.Item>
		<Menu.Item>
			<span mix={[grow()]}>Open…</span>
			<Keyboard>⌘O</Keyboard>
		</Menu.Item>
		<Menu.Separator />
		<Menu.Item>
			<span mix={[grow()]}>Save</span>
			<Keyboard>⌘S</Keyboard>
		</Menu.Item>
		<Menu.Item disabled>
			<span mix={[grow()]}>Save as…</span>
		</Menu.Item>
	</Menu>

	<Menubar.Trigger commandfor="edit-menu">Edit</Menubar.Trigger>
	<Menu id="edit-menu" aria-label="Edit" placement="bottom" mix={[menuKeys()]}>
		<Menu.Item>
			<span mix={[grow()]}>Undo</span>
			<Keyboard>⌘Z</Keyboard>
		</Menu.Item>
		<Menu.Item>
			<span mix={[grow()]}>Redo</span>
			<Keyboard>⇧⌘Z</Keyboard>
		</Menu.Item>
		<Menu.Separator />
		<Menu.Item>
			<span mix={[grow()]}>Find and replace</span>
			<Keyboard>⌘F</Keyboard>
		</Menu.Item>
	</Menu>

	<Menubar.Trigger commandfor="view-menu">View</Menubar.Trigger>
	<Menu id="view-menu" aria-label="View" placement="bottom" mix={[menuKeys()]}>
		<Menu.Item aria-selected="true">Outline</Menu.Item>
		<Menu.Item>Preview</Menu.Item>
		<Menu.Item>Split</Menu.Item>
	</Menu>

	<Menubar.Trigger commandfor="insert-menu">Insert</Menubar.Trigger>
	<Menu id="insert-menu" aria-label="Insert" placement="bottom" mix={[menuKeys()]}>
		<Menu.Item>Image</Menu.Item>
		<Menu.Item>Table</Menu.Item>
		<Menu.Item>Code block</Menu.Item>
	</Menu>

	<Menubar.Trigger commandfor="help-menu">Help</Menubar.Trigger>
	<Menu id="help-menu" aria-label="Help" placement="bottom" mix={[menuKeys()]}>
		<Menu.Item href="/docs">Documentation</Menu.Item>
		<Menu.Item href="/api/ui">Component catalogue</Menu.Item>
		<Menu.Separator />
		<Menu.Item>Keyboard shortcuts</Menu.Item>
	</Menu>

	<Menubar.Trigger commandfor="history-menu" aria-disabled="true">
		History
	</Menubar.Trigger>
	<Menu id="history-menu" aria-label="History" placement="bottom" mix={[menuKeys()]}>
		<Menu.Item>Version history</Menu.Item>
	</Menu>
</Menubar>`;

/** An editor's menu bar, hydrated so the row is one tab stop with arrows between triggers. */
export const MenubarPreview = clientEntry(
	"/resources/components/previews/menubar.tsx#MenubarPreview",
	function MenubarPreview() {
		return () => (
			<Menubar aria-label="Editor" mix={[menubarKeys()]}>
				<Menubar.Trigger commandfor="preview-menubar-file">File</Menubar.Trigger>
				<Menu id="preview-menubar-file" aria-label="File" placement="bottom" mix={[menuKeys()]}>
					<Menu.Item>
						<span mix={[grow()]}>New document</span>
						<Keyboard>⌘N</Keyboard>
					</Menu.Item>
					<Menu.Item>
						<span mix={[grow()]}>Open…</span>
						<Keyboard>⌘O</Keyboard>
					</Menu.Item>
					<Menu.Separator />
					<Menu.Item>
						<span mix={[grow()]}>Save</span>
						<Keyboard>⌘S</Keyboard>
					</Menu.Item>
					<Menu.Item disabled>
						<span mix={[grow()]}>Save as…</span>
					</Menu.Item>
				</Menu>

				<Menubar.Trigger commandfor="preview-menubar-edit">Edit</Menubar.Trigger>
				<Menu id="preview-menubar-edit" aria-label="Edit" placement="bottom" mix={[menuKeys()]}>
					<Menu.Item>
						<span mix={[grow()]}>Undo</span>
						<Keyboard>⌘Z</Keyboard>
					</Menu.Item>
					<Menu.Item>
						<span mix={[grow()]}>Redo</span>
						<Keyboard>⇧⌘Z</Keyboard>
					</Menu.Item>
					<Menu.Separator />
					<Menu.Item>
						<span mix={[grow()]}>Find and replace</span>
						<Keyboard>⌘F</Keyboard>
					</Menu.Item>
				</Menu>

				<Menubar.Trigger commandfor="preview-menubar-view">View</Menubar.Trigger>
				<Menu id="preview-menubar-view" aria-label="View" placement="bottom" mix={[menuKeys()]}>
					<Menu.Item aria-selected="true">Outline</Menu.Item>
					<Menu.Item>Preview</Menu.Item>
					<Menu.Item>Split</Menu.Item>
				</Menu>

				<Menubar.Trigger commandfor="preview-menubar-insert">Insert</Menubar.Trigger>
				<Menu id="preview-menubar-insert" aria-label="Insert" placement="bottom" mix={[menuKeys()]}>
					<Menu.Item>Image</Menu.Item>
					<Menu.Item>Table</Menu.Item>
					<Menu.Item>Code block</Menu.Item>
				</Menu>

				<Menubar.Trigger commandfor="preview-menubar-help">Help</Menubar.Trigger>
				<Menu id="preview-menubar-help" aria-label="Help" placement="bottom" mix={[menuKeys()]}>
					<Menu.Item href="/docs">Documentation</Menu.Item>
					<Menu.Item href="/api/ui">Component catalogue</Menu.Item>
					<Menu.Separator />
					<Menu.Item>Keyboard shortcuts</Menu.Item>
				</Menu>

				<Menubar.Trigger commandfor="preview-menubar-history" aria-disabled="true">
					History
				</Menubar.Trigger>
				<Menu
					id="preview-menubar-history"
					aria-label="History"
					placement="bottom"
					mix={[menuKeys()]}
				>
					<Menu.Item>Version history</Menu.Item>
				</Menu>
			</Menubar>
		);
	},
);

export default { code: CODE, render: () => <MenubarPreview /> };
