/**
 * Live demo for `contributionGraphKeys()`: a year of commits whose days the arrow keys walk, with one
 * shared tooltip naming the focused or hovered day's count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import preview from "~/resources/components/previews/contribution-graph";

/** What the preview registry reads: the component carrying the mixin, and its source. */
export default {
	code: `// ContributionGraph's tooltip carries contributionGraphKeys(), so the arrows walk the days.\n${preview.code}`,
	render: preview.render,
};
