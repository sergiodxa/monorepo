/**
 * Live example for `AccentText variant="pill"` inside a display headline: one word set
 * uppercase at half the heading's size in an outlined capsule, the way a gateway page
 * names its category.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Heading, HeadingScope } from "@sdxc/ui";
import { AccentText } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<Heading size="display">
	The <AccentText variant="pill">AI</AccentText> gateway
</Heading>`;

/** What the preview registry reads: the title, the source to show, and the headline to draw. */
export default {
	title: "A pill word in a display heading",
	code: CODE,
	render: () => (
		<HeadingScope level={2}>
			<Heading size="display">
				The <AccentText variant="pill">AI</AccentText> gateway
			</Heading>
		</HeadingScope>
	),
};
