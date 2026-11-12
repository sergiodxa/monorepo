/**
 * Client island: the share menu's "Copy link" row. It is a link to the post, so without
 * script it opens the post, whose address is then in the address bar to copy; with script it
 * puts the full address on the clipboard instead, says so in place, and closes its menu.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { LinkIcon } from "@sdxc/icons";
import { Menu } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** Props the island serializes; a `type`, since serialized props reject an interface. */
export type CopyLinkProps = {
	/** The post's path; the row copies it as a full address on this origin. */
	path: string;
	/** The id of the menu the row closes once the link is copied. */
	menu: string;
	labels: { copy: string; copied: string };
};

/**
 * Renders the row as a link to the post; after a copy it reads "Link copied" until the menu
 * closes. A browser without the clipboard API follows the link instead.
 */
export const CopyLink: EntryComponent<CopyLinkProps> = clientEntry(
	import.meta.url,
	function CopyLink(handle) {
		let copied = false;
		return () => {
			let { labels, menu, path } = handle.props;
			return (
				<Menu.Item
					href={path}
					mix={[
						on<HTMLAnchorElement | HTMLButtonElement, "click">("click", async (event) => {
							if (!navigator.clipboard) return;
							event.preventDefault();
							let button = event.currentTarget;
							let written = await navigator.clipboard
								.writeText(new URL(path, location.href).href)
								.then(
									() => true,
									() => false,
								);
							copied = written === true;
							void handle.update();
							if (copied) {
								setTimeout(() => {
									document.getElementById(menu)?.hidePopover();
									copied = false;
									void handle.update();
								}, 700);
							}
							button.blur();
						}),
					]}
				>
					<LinkIcon size={16} aria-hidden="true" />
					<span aria-live="polite">{copied ? labels.copied : labels.copy}</span>
				</Menu.Item>
			);
		};
	},
);
