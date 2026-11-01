/**
 * The two appearance settings: the colour scheme and the reading face, both of which
 * follow the reader to any browser they sign in on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Steps, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { H2 } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "change", text: "Change colours and face", level: 2 },
	{ id: "where", text: "Where it applies", level: 2 },
];

/** The appearance guide's body. */
export default function Appearance(_handle: Handle<DocBody.Props>) {
	return () => (
		<>
			<H2 id="change">Change colours and face</H2>
			<Steps>
				<Steps.Item title="Open the setting">
					<p>
						Open <UiPath items={["Settings", "How your pages look"]} />.
					</p>
				</Steps.Item>
				<Steps.Item title="Choose colours">
					<p>
						Under <UiLabel>Colours</UiLabel>, pick <UiLabel>Follow my system</UiLabel>,{" "}
						<UiLabel>Light</UiLabel> or <UiLabel>Dark</UiLabel>.
					</p>
				</Steps.Item>
				<Steps.Item title="Choose a reading face">
					<p>
						Under <UiLabel>Reading face</UiLabel>, pick <UiLabel>Sans serif</UiLabel> or{" "}
						<UiLabel>Serif</UiLabel>, then press <UiLabel>Save</UiLabel>.
					</p>
				</Steps.Item>
			</Steps>

			<H2 id="where">Where it applies</H2>
			<p>
				Both take effect on the next page and follow you to any browser you sign in on. The face is
				used for posts and articles; menus and controls stay as they are.
			</p>
		</>
	);
}
