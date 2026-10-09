/**
 * Live example for a `Tree` with no nodes to show. `data-empty` centers the message in
 * the tree's own frame, so an empty folder keeps the shape and label the populated tree
 * has and the example is plain server markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { Tree } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<Tree aria-label="Files" data-empty>
	No files in this folder yet.
</Tree>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Empty",
	code: CODE,
	render: () => (
		<Tree aria-label="Files" data-empty mix={[is("20rem")]}>
			No files in this folder yet.
		</Tree>
	),
};
