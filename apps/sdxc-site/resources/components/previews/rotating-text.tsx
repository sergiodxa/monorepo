/**
 * Live preview for `RotatingText`: a display headline whose last word cycles through
 * three audiences twice, then settles on the first. Every alternative is read to a screen
 * reader in the word's place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { RotatingText } from "@sdxc/ui/patterns";
import { displayHeading } from "@sdxc/ui/styles";

/** The source the page shows, matching the markup below. */
const CODE = `<h2 mix={[displayHeading(2)]}>
	Status pages for{" "}
	<RotatingText words={["startups", "agencies", "platform teams"]} />
</h2>`;

/** What the preview registry reads: the source to show, and the headline to draw. */
export default {
	code: CODE,
	render: () => (
		<p mix={[displayHeading(2)]}>
			Status pages for{" "}
			<RotatingText words={["startups", "agencies", "platform teams"]} mix={[fg("brand")]} />
		</p>
	),
};
