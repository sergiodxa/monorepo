/**
 * Live example for a vertical `Separator` splitting a row of inline facts. The hairline
 * takes the row's height, so the example sits it between items on one line; the markup
 * is static and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { Separator, Text } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[hstack({ gap: 4, align: "center" })]}>
	<Text>Docs</Text>
	<Separator aria-orientation="vertical" />
	<Text>Changelog</Text>
	<Separator aria-orientation="vertical" />
	<Text>Status</Text>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Vertical",
	code: CODE,
	render: () => (
		<div mix={[hstack({ gap: 4, align: "center" })]}>
			<Text>Docs</Text>
			<Separator aria-orientation="vertical" />
			<Text>Changelog</Text>
			<Separator aria-orientation="vertical" />
			<Text>Status</Text>
		</div>
	),
};
