/**
 * The reference for every key the reading surfaces answer, in the order the in-app panel
 * lists them, and the rule that a field being typed in leaves every key alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle, RemixNode } from "remix/component";

import { UiLabel } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { FactTable, H2, Kbd } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "keys", text: "Every key", level: 2 },
	{ id: "panel", text: "See them in Reader", level: 2 },
	{ id: "fields", text: "Typing in a field", level: 2 },
];

/** Each key and what it does, in the order the in-app panel lists them. */
const KEYS: [RemixNode, string][] = [
	[<Kbd>j</Kbd>, "Next post"],
	[<Kbd>k</Kbd>, "Previous post"],
	[<Kbd>n</Kbd>, "Next unread post"],
	[<Kbd>o</Kbd>, "Open the post"],
	[<Kbd>m</Kbd>, "Mark as read or unread"],
	[<Kbd>s</Kbd>, "Save the post, or stop saving it"],
	[<Kbd>r</Kbd>, "Check every feed"],
	[
		<>
			<Kbd>Shift</Kbd> <Kbd>J</Kbd>
		</>,
		"Next feed",
	],
	[
		<>
			<Kbd>Shift</Kbd> <Kbd>K</Kbd>
		</>,
		"Previous feed",
	],
	[<Kbd>/</Kbd>, "Search your posts"],
	[<Kbd>?</Kbd>, "Show these shortcuts"],
];

/** The shortcuts reference's body. */
export default function KeyboardShortcuts(_handle: Handle<DocBody.Props>) {
	return () => (
		<>
			<H2 id="keys">Every key</H2>
			<p>
				These work on every page of Reader once you are signed in. Moving between posts works
				wherever posts are listed.
			</p>
			<FactTable
				caption="Keyboard shortcuts while reading."
				head={["Key", "What it does"]}
				rows={KEYS}
			/>

			<H2 id="panel">See them in Reader</H2>
			<p>
				Press <Kbd>?</Kbd>, or <UiLabel>Keyboard shortcuts</UiLabel>, to open the same list over the
				page. Press <Kbd>Esc</Kbd> to close it.
			</p>

			<H2 id="fields">Typing in a field</H2>
			<p>
				While you type in a field, such as search or the follow box, every key types as usual. Click
				outside the field to use the shortcuts again.
			</p>
		</>
	);
}
