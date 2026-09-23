/**
 * Live preview island for `Toolbar`. A strip of controls is only a toolbar once it
 * carries clusters, so the example is an editor's: a block-level select, formatting
 * toggles, block toggles and an overflow menu, each cluster set off by a vertical
 * separator. The toggles keep no state of their own, so the preview carries the
 * `pressToggle()` wiring a reader applies, and `menuKeys()` on the overflow menu.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	BoldIcon,
	CodeIcon,
	EllipsisIcon,
	ItalicIcon,
	Link2Icon,
	ListIcon,
	ListOrderedIcon,
	Trash2Icon,
	UnderlineIcon,
} from "@sdxc/icons";
import { Button, Menu, Select, Separator, ToggleButton, Toolbar } from "@sdxc/ui";
import { menuKeys, pressToggle } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const TOOLBAR_CODE = `<Toolbar aria-label="Formatting">
	<Select aria-label="Block type">
		<Select.Option value="p">Paragraph</Select.Option>
		<Select.Option value="h2">Heading 2</Select.Option>
		<Select.Option value="quote">Quote</Select.Option>
	</Select>

	<Separator aria-orientation="vertical" />

	<ToggleButton aria-pressed="true" aria-label="Bold" variant="ghost" size="sm" mix={[pressToggle()]}>
		<BoldIcon />
	</ToggleButton>
	<ToggleButton aria-pressed="false" aria-label="Italic" variant="ghost" size="sm" mix={[pressToggle()]}>
		<ItalicIcon />
	</ToggleButton>
	<ToggleButton aria-pressed="false" aria-label="Underline" variant="ghost" size="sm" mix={[pressToggle()]}>
		<UnderlineIcon />
	</ToggleButton>

	<Separator aria-orientation="vertical" />

	<ToggleButton aria-pressed="false" aria-label="Inline code" variant="ghost" size="sm" mix={[pressToggle()]}>
		<CodeIcon />
	</ToggleButton>
	<ToggleButton aria-pressed="false" aria-label="Numbered list" variant="ghost" size="sm" mix={[pressToggle()]}>
		<ListOrderedIcon />
	</ToggleButton>
	<ToggleButton aria-pressed="false" aria-label="Bulleted list" variant="ghost" size="sm" mix={[pressToggle()]}>
		<ListIcon />
	</ToggleButton>

	<Separator aria-orientation="vertical" />

	<Button
		commandfor="preview-toolbar-more"
		command="toggle-popover"
		variant="ghost"
		size="sm"
		aria-label="More formatting"
	>
		<EllipsisIcon />
	</Button>
	<Menu id="preview-toolbar-more" aria-label="More formatting" mix={[menuKeys()]}>
		<Menu.Item>
			<Link2Icon aria-hidden="true" />
			Insert link
		</Menu.Item>
		<Menu.Separator />
		<Menu.Item danger>
			<Trash2Icon aria-hidden="true" />
			Clear formatting
		</Menu.Item>
	</Menu>
</Toolbar>`;

/** An editor toolbar of four clusters, hydrated so every toggle flips and the menu walks. */
export const ToolbarPreview = clientEntry(
	"/resources/components/previews/toolbar.tsx#ToolbarPreview",
	function ToolbarPreview() {
		return () => (
			<Toolbar aria-label="Formatting">
				<Select aria-label="Block type">
					<Select.Option value="p">Paragraph</Select.Option>
					<Select.Option value="h2">Heading 2</Select.Option>
					<Select.Option value="quote">Quote</Select.Option>
				</Select>

				<Separator aria-orientation="vertical" />

				<ToggleButton
					aria-pressed="true"
					aria-label="Bold"
					variant="ghost"
					size="sm"
					mix={[pressToggle()]}
				>
					<BoldIcon />
				</ToggleButton>
				<ToggleButton
					aria-pressed="false"
					aria-label="Italic"
					variant="ghost"
					size="sm"
					mix={[pressToggle()]}
				>
					<ItalicIcon />
				</ToggleButton>
				<ToggleButton
					aria-pressed="false"
					aria-label="Underline"
					variant="ghost"
					size="sm"
					mix={[pressToggle()]}
				>
					<UnderlineIcon />
				</ToggleButton>

				<Separator aria-orientation="vertical" />

				<ToggleButton
					aria-pressed="false"
					aria-label="Inline code"
					variant="ghost"
					size="sm"
					mix={[pressToggle()]}
				>
					<CodeIcon />
				</ToggleButton>
				<ToggleButton
					aria-pressed="false"
					aria-label="Numbered list"
					variant="ghost"
					size="sm"
					mix={[pressToggle()]}
				>
					<ListOrderedIcon />
				</ToggleButton>
				<ToggleButton
					aria-pressed="false"
					aria-label="Bulleted list"
					variant="ghost"
					size="sm"
					mix={[pressToggle()]}
				>
					<ListIcon />
				</ToggleButton>

				<Separator aria-orientation="vertical" />

				<Button
					commandfor="preview-toolbar-more"
					command="toggle-popover"
					variant="ghost"
					size="sm"
					aria-label="More formatting"
				>
					<EllipsisIcon />
				</Button>
				<Menu id="preview-toolbar-more" aria-label="More formatting" mix={[menuKeys()]}>
					<Menu.Item>
						<Link2Icon aria-hidden="true" />
						Insert link
					</Menu.Item>
					<Menu.Separator />
					<Menu.Item danger>
						<Trash2Icon aria-hidden="true" />
						Clear formatting
					</Menu.Item>
				</Menu>
			</Toolbar>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TOOLBAR_CODE, render: () => <ToolbarPreview /> };
