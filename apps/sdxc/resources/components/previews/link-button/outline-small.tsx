/**
 * Live example for a small, outlined `LinkButton` in the neutral color. A form's way out
 * is a link back to where the reader came from, so it takes the quieter weight beside the
 * submit button and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LinkButton } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<LinkButton href="/api/ui" color="neutral" variant="outline" size="sm">
	Cancel
</LinkButton>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Outline, small",
	code: CODE,
	render: () => (
		<LinkButton href="/api/ui" color="neutral" variant="outline" size="sm">
			Cancel
		</LinkButton>
	),
};
