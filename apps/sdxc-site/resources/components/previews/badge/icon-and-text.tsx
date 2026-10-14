/**
 * Live example for a `Badge` pairing an icon with its label. `Badge.Icon` and `Badge.Text`
 * keep the glyph and the words aligned at the badge's size, and the secondary variant
 * gives the success color a soft fill.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CheckIcon } from "@sdxc/icons";
import { Badge } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Badge color="success" variant="secondary">
	<Badge.Icon>
		<CheckIcon />
	</Badge.Icon>
	<Badge.Text>Active</Badge.Text>
</Badge>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "With an icon",
	code: CODE,
	render: () => (
		<Badge color="success" variant="secondary">
			<Badge.Icon>
				<CheckIcon />
			</Badge.Icon>
			<Badge.Text>Active</Badge.Text>
		</Badge>
	),
};
