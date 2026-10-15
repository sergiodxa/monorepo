/**
 * Live example for an outline `Badge` in the danger color. The outline variant draws the
 * color as a border and text only, so a failed status stays legible beside filled badges
 * without outweighing them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Badge color="danger" variant="outline">
	Failed
</Badge>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Outline, danger color",
	code: CODE,
	render: () => (
		<Badge color="danger" variant="outline">
			Failed
		</Badge>
	),
};
