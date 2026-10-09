/**
 * Live example for a `NavLink` drawn over its own fill. `hasBackground` drops the
 * underline because the tinted pill already sets the link apart, which is how a sidebar
 * or tab-like nav row reads; the padding and fill come from the caller's mixins.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { pb, pi } from "@sdxc/u/size";
import { NavLink } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<NavLink href="/docs" hasBackground mix={[pi(3), pb(2), rounded("md"), bg("neutral.tint")]}>
	Guides
</NavLink>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "With a background",
	code: CODE,
	render: () => (
		<NavLink href="/docs" hasBackground mix={[pi(3), pb(2), rounded("md"), bg("neutral.tint")]}>
			Guides
		</NavLink>
	),
};
