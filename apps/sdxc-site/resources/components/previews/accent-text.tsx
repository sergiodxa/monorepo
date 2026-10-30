/**
 * Live preview for `AccentText`: display headlines that stress one phrase three ways —
 * the brand color, a hand-drawn swash under it, and a marker band behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { Heading, HeadingScope } from "@sdxc/ui";
import { AccentText } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<Heading size="display">
	Know it is down <AccentText variant="swash">before</AccentText> your users do
</Heading>
<Heading size="display">
	Incidents that write <AccentText variant="highlight">their own postmortem</AccentText>
</Heading>
<Heading size="display">
	Status pages your customers <AccentText>actually read</AccentText>
</Heading>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<HeadingScope>
			<div mix={[vstack({ gap: 8, align: "stretch" })]}>
				<Heading size="display">
					Know it is down <AccentText variant="swash">before</AccentText> your users do
				</Heading>
				<Heading size="display">
					Incidents that write <AccentText variant="highlight">their own postmortem</AccentText>
				</Heading>
				<Heading size="display">
					Status pages your customers <AccentText>actually read</AccentText>
				</Heading>
			</div>
		</HeadingScope>
	),
};
