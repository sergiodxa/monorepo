/**
 * Live example for a `Skeleton` shaped through `style` into the round placeholder an
 * avatar loads behind. The block holds still with no motion mixin, so the example is
 * static server markup and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Skeleton } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Skeleton style={{ blockSize: "2.5rem", inlineSize: "2.5rem", borderRadius: "9999px" }} />`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Round avatar",
	code: CODE,
	render: () => (
		<Skeleton style={{ blockSize: "2.5rem", inlineSize: "2.5rem", borderRadius: "9999px" }} />
	),
};
