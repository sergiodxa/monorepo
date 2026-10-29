/**
 * Live preview for `AccentText`: one phrase of a display headline set in the brand color,
 * so the claim's key word carries the accent without a second heading.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Heading, HeadingScope } from "@sdxc/ui";
import { AccentText } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<Heading size="display">
	Know it is down <AccentText>before</AccentText> your users do
</Heading>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<HeadingScope>
			<Heading size="display">
				Know it is down <AccentText>before</AccentText> your users do
			</Heading>
		</HeadingScope>
	),
};
