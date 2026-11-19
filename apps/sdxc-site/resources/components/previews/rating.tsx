/**
 * Live preview for `Rating`: a product's average with its review count, a smaller one as it
 * sits in a review, and a score worded for a different scale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Rating } from "@sdxc/ui";

/** The source the page shows. */
const CODE = `<Rating value={4.6} count={128} />
<Rating value={3.5} size="sm" countLabel="42 reviews" />
<Rating value={8.4} max={10} label="{value} out of {max}" />`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ display: "grid", gap: "1rem", justifyItems: "start" })]}>
			<Rating value={4.6} count={128} />
			<Rating value={3.5} size="sm" countLabel="42 reviews" />
			<Rating value={8.4} max={10} label="{value} out of {max}" />
		</div>
	),
};
