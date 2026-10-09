/**
 * Live example for an empty `AspectRatio` holding a 4:3 slot before its media arrives. The
 * box takes its height from its width alone, so a tint is all it needs to show the space
 * it reserves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { is } from "@sdxc/u/size";
import { AspectRatio } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[is("16rem")]}>
	<AspectRatio ratio={4 / 3} mix={[rounded("lg"), bg("neutral.bg-tint-pressed")]} />
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Reserved space",
	code: CODE,
	render: () => (
		<div mix={[is("16rem")]}>
			<AspectRatio ratio={4 / 3} mix={[rounded("lg"), bg("neutral.bg-tint-pressed")]} />
		</div>
	),
};
