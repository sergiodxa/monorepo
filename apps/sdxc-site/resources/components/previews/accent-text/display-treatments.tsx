/**
 * Live example for the display treatments of `AccentText`: a sheen that fades the ink
 * toward its end, an outlined pill word at half size, and a tinted chip led by a dot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { AccentText } from "@sdxc/ui/patterns";
import { displayHeading } from "@sdxc/ui/styles";

/** The source the page shows, matching the markup below. */
const CODE = `<h2 mix={[displayHeading(2)]}>
	Email for <AccentText variant="sheen">developers</AccentText>
</h2>
<h2 mix={[displayHeading(2)]}>
	The <AccentText variant="pill">AI</AccentText> gateway
</h2>
<h2 mix={[displayHeading(2)]}>
	Docs <AccentText variant="chip">for teams</AccentText>
</h2>`;

/** What the preview registry reads: the title, the source to show, and the headlines to draw. */
export default {
	title: "Sheen, pill and chip",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 6, align: "start" })]}>
			<p mix={[displayHeading(2)]}>
				Email for <AccentText variant="sheen">developers</AccentText>
			</p>
			<p mix={[displayHeading(2)]}>
				The <AccentText variant="pill">AI</AccentText> gateway
			</p>
			<p mix={[displayHeading(2)]}>
				Docs <AccentText variant="chip">for teams</AccentText>
			</p>
		</div>
	),
};
