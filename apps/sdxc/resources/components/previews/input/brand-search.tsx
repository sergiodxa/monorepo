/**
 * Live example for an `Input` in the brand color with a placeholder, the shape a search
 * box takes. The color sets the focus ring the browser draws, so the example is plain
 * server markup that needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Input } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Input
	type="search"
	name="q"
	aria-label="Search projects"
	color="brand"
	placeholder="Search Acme projects…"
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Brand search box",
	code: CODE,
	render: () => (
		<Input
			type="search"
			name="q"
			aria-label="Search projects"
			color="brand"
			placeholder="Search Acme projects…"
		/>
	),
};
