/**
 * Live example for a title-only `Empty` in the danger color. A missing record explains
 * itself with a title alone, and the color marks the state as an error the reader
 * can act on by going back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Empty } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Empty color="danger">
	<Empty.Title>We could not find that project</Empty.Title>
</Empty>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Danger color",
	code: CODE,
	render: () => (
		<Empty color="danger">
			<Empty.Title>We could not find that project</Empty.Title>
		</Empty>
	),
};
