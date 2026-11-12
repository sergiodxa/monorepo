/**
 * The workspace switcher and user menu every demo app's sidebar opens from its identity rows,
 * built on the native popover `Menu`, so the chevron those rows show always leads somewhere and
 * a demo signs the visitor out to the gallery it came from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { Menu } from "@sdxc/ui";

import routes from "~/routes/web";

namespace WorkspaceMenu {
	export interface Props {
		/** The menu's id, which the identity row's `commandfor` names. */
		id: string;
		/** The menu's accessible name, such as "Switch workspace". */
		label: string;
		/** The workspace the visitor is in, linking to its home. */
		current: { name: string; href: string };
		/** Other workspaces the invented person belongs to; picking one closes the menu. */
		others: readonly string[];
	}
}

/**
 * Lists the visitor's workspaces with the current one marked. The demo runs one workspace, so
 * the others close the menu rather than leaving for an address that does not exist.
 */
export function WorkspaceMenu(handle: Handle<WorkspaceMenu.Props>) {
	return () => {
		let { current, id, label, others } = handle.props;
		return (
			<Menu id={id} aria-label={label}>
				<Menu.Item href={current.href} aria-current="true">
					{current.name}
				</Menu.Item>
				{others.map((name) => (
					<Menu.Item key={name} commandfor={id} command="hide-popover">
						{name}
					</Menu.Item>
				))}
			</Menu>
		);
	};
}

namespace UserMenu {
	export interface Props {
		/** The menu's id, which the user row's `commandfor` names. */
		id: string;
		/** The menu's accessible name, such as "Account". */
		label: string;
		/** The page about the person; an app without one leaves the row out. */
		profileHref?: string;
		/** The app's settings home; an app without settings leaves the row out. */
		settingsHref?: string;
		/** Rows of the app's own before Sign out, such as a form that resets the demo. */
		extra?: RemixNode;
		/** The id of the page's keyboard help sheet, which the shortcuts item opens. */
		helpId: string;
	}
}

/**
 * The signed-in person's menu, opening upward from the sidebar's foot: their profile, the
 * app's settings, the keyboard help sheet, and Sign out, which returns to the demo gallery.
 */
export function UserMenu(handle: Handle<UserMenu.Props>) {
	return () => {
		let { extra, helpId, id, label, profileHref, settingsHref } = handle.props;
		return (
			<Menu id={id} placement="top-start" aria-label={label}>
				{profileHref === undefined ? null : <Menu.Item href={profileHref}>Profile</Menu.Item>}
				{settingsHref === undefined ? null : <Menu.Item href={settingsHref}>Settings</Menu.Item>}
				<Menu.Item commandfor={helpId} command="show-modal">
					Keyboard shortcuts
				</Menu.Item>
				{extra}
				<Menu.Separator />
				<Menu.Item href={routes.demos.href()}>Sign out</Menu.Item>
			</Menu>
		);
	};
}
