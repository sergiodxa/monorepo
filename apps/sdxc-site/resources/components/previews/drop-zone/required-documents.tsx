/**
 * Live example for a required `DropZone` taking several PDFs. `required`, `multiple` and
 * `accept` land on the native file input, so the browser filters the picker and blocks an
 * empty submission itself, and the example is plain markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DropZone } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<DropZone name="documents" multiple accept="application/pdf" required>
	<p>Drop the signed contracts here, PDF only</p>
</DropZone>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Required documents",
	code: CODE,
	render: () => (
		<DropZone name="documents" multiple accept="application/pdf" required>
			<p>Drop the signed contracts here, PDF only</p>
		</DropZone>
	),
};
