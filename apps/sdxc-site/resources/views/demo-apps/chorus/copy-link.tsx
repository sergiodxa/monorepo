/**
 * Client island: the share menu's "Copy link" row, which puts a post's full address on the
 * clipboard and says so in place, then closes its menu. The clipboard is script's alone; the
 * menu's other rows are links and work without it.
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

/** Renders the row; after a copy it reads "Link copied" until the menu next opens. */
export const CopyLink: EntryComponent<CopyLinkProps> = clientEntry(
	import.meta.url,
	function CopyLink(handle) {
		let copied = false;
		return () => {
			let { labels, menu, path } = handle.props;
			return (
				<Menu.Item
					type="button"
					mix={[
						on<HTMLAnchorElement | HTMLButtonElement, "click">("click", async (event) => {
							let button = event.currentTarget;
							let written = await navigator.clipboard
								?.writeText(new URL(path, location.href).href)
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
