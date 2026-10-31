/**
 * Live preview for `DocsPager`: the foot of a guide whose previous page sits in the same
 * section and whose next page crosses into another, so the next card names its section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { DocsPager } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `let { previous, next } = findNeighbours(tree, "/docs/monitors/http");

<DocsPager
	previous={previous}
	next={next}
	section="Monitors"
	labels={{ nav: "Pagination", previous: "Previous", next: "Next" }}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<DocsPager
				previous={{ title: "Add a monitor", href: "#add-a-monitor", section: "Monitors" }}
				next={{ title: "Route alerts to the person on call", href: "#alerts", section: "Alerts" }}
				section="Monitors"
				labels={{ nav: "Pagination", previous: "Previous", next: "Next" }}
			/>
		</div>
	),
};
