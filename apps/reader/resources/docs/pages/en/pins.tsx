/**
 * Pinning a feed: what the strip above the queue shows, where a pin is set and taken
 * off, and how many each plan pins.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { H2 } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "pin", text: "Pin a feed", level: 2 },
	{ id: "strip", text: "What the strip shows", level: 2 },
	{ id: "limit", text: "How many you can pin", level: 2 },
];

/** The pins guide's body. */
export default function Pins(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures } = handle.props;
		return (
			<>
				<p>
					Pin the few feeds you never want to miss. They sit in a strip above your queue, and first
					in the sidebar, so you see them before anything else.
				</p>

				<H2 id="pin">Pin a feed</H2>
				<p>
					Open the feed's page and choose <UiPath items={["More actions", "Pin"]} />. The same menu
					says <UiLabel>Unpin</UiLabel> on a pinned feed.
				</p>

				<H2 id="strip">What the strip shows</H2>
				<p>
					The strip sits at the top of Reading. Each pinned feed in it shows how many posts are
					waiting, or <UiLabel>Nothing new.</UiLabel> when you are caught up. In the sidebar, pinned
					feeds are drawn first, under <UiLabel>Pinned</UiLabel>.
				</p>

				<H2 id="limit">How many you can pin</H2>
				<p>
					Free pins {figures.freePins} feeds; Paid and Premium pin {figures.pinLimit}. When you
					reach yours, unpin one or move up a plan to pin another.
				</p>
			</>
		);
	};
}
