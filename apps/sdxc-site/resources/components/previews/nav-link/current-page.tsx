/**
 * Live example for `NavLink` marking the page being viewed. The server sets
 * `aria-current="page"` on the link whose `href` matches the request path, so the
 * emphasis is in the markup before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { NavLink } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<nav aria-label="Site" mix={[hstack({ gap: 4, align: "center" })]}>
	<NavLink href="/">Home</NavLink>
	<NavLink href="/docs">Guides</NavLink>
	<NavLink href="/api/ui" aria-current="page">
		Components
	</NavLink>
	<NavLink href="/showcase">Showcase</NavLink>
</nav>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Current page",
	code: CODE,
	render: () => (
		<nav aria-label="Site" mix={[hstack({ gap: 4, align: "center" })]}>
			<NavLink href="/">Home</NavLink>
			<NavLink href="/docs">Guides</NavLink>
			<NavLink href="/api/ui" aria-current="page">
				Components
			</NavLink>
			<NavLink href="/showcase">Showcase</NavLink>
		</nav>
	),
};
