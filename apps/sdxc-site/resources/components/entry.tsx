/**
 * The visible title and summary of an h-entry. The title links the page's permalink, so
 * the name, URL and uid a parser reads are the heading a reader sees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { mf } from "@sdxc/microformats/ui";
import { fg } from "@sdxc/u/color";
import { textDecoration } from "@sdxc/u/typography";

namespace EntryTitle {
	export interface Props {
		/** The page's permalink, root-relative, which is the entry's url and uid. */
		href: string;
		children: RemixNode;
	}
}

/**
 * Renders the entry's name as its permalink. The link keeps the heading's color and
 * drops its underline, so the title reads as a heading.
 *
 * @param handle Runtime handle carrying the permalink and the heading text.
 * @returns The render function producing the linked name.
 */
export function EntryTitle(handle: Handle<EntryTitle.Props>) {
	return () => (
		<a
			href={handle.props.href}
			mix={[mf("p-name", "u-url", "u-uid"), textDecoration("none"), fg("neutral.emphasis")]}
		>
			{handle.props.children}
		</a>
	);
}

/**
 * Renders the entry's summary. It sits inside the header's lead, which is already a
 * paragraph, so the summary is a span.
 *
 * @param handle Runtime handle carrying the summary text.
 * @returns The render function producing the summary.
 */
export function EntrySummary(handle: Handle<{ children: RemixNode }>) {
	return () => <span mix={[mf("p-summary")]}>{handle.props.children}</span>;
}
