/**
 * Live example for a `Link` in the danger color. The link sits inside the sentence that
 * warns about what it does, so the color backs up words the reader already has and the
 * example is plain server markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<p mix={[m(0), text("sm"), fg("neutral")]}>
	Deleting removes every issue and comment for everyone at Acme:{" "}
	<Link href="#delete-project" color="danger">
		delete this project
	</Link>
	.
</p>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Danger color",
	code: CODE,
	render: () => (
		<p mix={[m(0), text("sm"), fg("neutral")]}>
			Deleting removes every issue and comment for everyone at Acme:{" "}
			<Link href="#delete-project" color="danger">
				delete this project
			</Link>
			.
		</p>
	),
};
