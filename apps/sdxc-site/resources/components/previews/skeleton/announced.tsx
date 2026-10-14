/**
 * Live example for a `Skeleton` exposed to assistive technology. `aria-hidden="false"`
 * lifts the default that keeps a placeholder out of the accessibility tree, and
 * `role="status"` gives the label a role it may name, so screen readers hear what is loading.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { Skeleton } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[is("16rem")]}>
	<Skeleton role="status" aria-hidden="false" aria-label="Loading Ana's profile" />
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Announced to screen readers",
	code: CODE,
	render: () => (
		<div mix={[is("16rem")]}>
			<Skeleton role="status" aria-hidden="false" aria-label="Loading Ana's profile" />
		</div>
	),
};
