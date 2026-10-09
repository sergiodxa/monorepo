/**
 * Live example for an icon-only `DropZone`. With no visible text, `aria-label` names the
 * zone and its file input; the zone is a `<label>` around that input, so clicking opens the
 * picker with no script and the example is plain markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ImageIcon } from "@sdxc/icons";
import { DropZone } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<DropZone name="avatar" accept="image/png, image/jpeg" aria-label="Choose a profile photo">
	<ImageIcon aria-hidden="true" />
</DropZone>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Icon only",
	code: CODE,
	render: () => (
		<DropZone name="avatar" accept="image/png, image/jpeg" aria-label="Choose a profile photo">
			<ImageIcon aria-hidden="true" />
		</DropZone>
	),
};
