/**
 * Live preview island for `Menu`. The surface opens and closes through the Popover API
 * with no script at all; what script adds is the WAI-ARIA menu pattern, so the preview
 * carries `menuKeys()` on the surface — roving tabindex, arrows, Home/End and typeahead
 * — over the grouped rows, shortcut hints and destructive action a row menu really holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	ChevronDownIcon,
	CopyIcon,
	ExternalLinkIcon,
	PencilIcon,
	ShareIcon,
	Trash2Icon,
	UserPlusIcon,
} from "@sdxc/icons";
import { grow } from "@sdxc/u/layout";
import { Button, Header, Keyboard, Menu, Section } from "@sdxc/ui";
import { menuKeys } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `<Button commandfor="issue-menu" command="toggle-popover" variant="outline">
	Issue actions
	<ChevronDownIcon />
</Button>

<Menu id="issue-menu" aria-label="Issue actions" placement="bottom" mix={[menuKeys()]}>
	<Section aria-labelledby="issue-menu-edit">
		<Header id="issue-menu-edit">Edit</Header>
		<Menu.Item href="/issues/482/edit">
			<PencilIcon />
			<span mix={[grow()]}>Rename</span>
			<Keyboard>R</Keyboard>
		</Menu.Item>
		<Menu.Item>
			<UserPlusIcon />
			<span mix={[grow()]}>Assign to teammate</span>
			<Keyboard>A</Keyboard>
		</Menu.Item>
	</Section>

	<Menu.Separator />

	<Section aria-labelledby="issue-menu-share">
		<Header id="issue-menu-share">Share</Header>
		<Menu.Item>
			<CopyIcon />
			<span mix={[grow()]}>Copy link</span>
			<Keyboard>⌘C</Keyboard>
		</Menu.Item>
		<Menu.Item href="/issues/482" target="_blank" rel="noreferrer">
			<ExternalLinkIcon />
			<span mix={[grow()]}>Open in new tab</span>
		</Menu.Item>
		<Menu.Item disabled>
			<ShareIcon />
			<span mix={[grow()]}>Share externally</span>
		</Menu.Item>
	</Section>

	<Menu.Separator />

	<Menu.Item danger>
		<Trash2Icon />
		<span mix={[grow()]}>Delete issue</span>
		<Keyboard>⌫</Keyboard>
	</Menu.Item>
</Menu>`;

/** An issue's action menu, hydrated so the keyboard pattern has somewhere to run. */
export const MenuPreview = clientEntry(
	"/resources/components/previews/menu.tsx#MenuPreview",
	function MenuPreview() {
		return () => (
			<>
				<Button commandfor="preview-issue-menu" command="toggle-popover" variant="outline">
					Issue actions
					<ChevronDownIcon />
				</Button>

				<Menu
					id="preview-issue-menu"
					aria-label="Issue actions"
					placement="bottom"
					mix={[menuKeys()]}
				>
					<Section aria-labelledby="preview-issue-menu-edit">
						<Header id="preview-issue-menu-edit">Edit</Header>
						<Menu.Item href="/issues/482/edit">
							<PencilIcon />
							<span mix={[grow()]}>Rename</span>
							<Keyboard>R</Keyboard>
						</Menu.Item>
						<Menu.Item>
							<UserPlusIcon />
							<span mix={[grow()]}>Assign to teammate</span>
							<Keyboard>A</Keyboard>
						</Menu.Item>
					</Section>

					<Menu.Separator />

					<Section aria-labelledby="preview-issue-menu-share">
						<Header id="preview-issue-menu-share">Share</Header>
						<Menu.Item>
							<CopyIcon />
							<span mix={[grow()]}>Copy link</span>
							<Keyboard>⌘C</Keyboard>
						</Menu.Item>
						<Menu.Item href="/issues/482" target="_blank" rel="noreferrer">
							<ExternalLinkIcon />
							<span mix={[grow()]}>Open in new tab</span>
						</Menu.Item>
						<Menu.Item disabled>
							<ShareIcon />
							<span mix={[grow()]}>Share externally</span>
						</Menu.Item>
					</Section>

					<Menu.Separator />

					<Menu.Item danger>
						<Trash2Icon />
						<span mix={[grow()]}>Delete issue</span>
						<Keyboard>⌫</Keyboard>
					</Menu.Item>
				</Menu>
			</>
		);
	},
);

export default { code: CODE, render: () => <MenuPreview /> };
