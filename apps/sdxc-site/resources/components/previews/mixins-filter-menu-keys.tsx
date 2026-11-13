/**
 * Live demo for `filterMenuKeys()`: a branch picker whose filter field keeps focus while the arrow
 * keys move through the rows and Enter picks the highlighted one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import preview from "~/resources/components/previews/filter-menu";

/** What the preview registry reads: the component carrying the mixin, and its source. */
export default {
	code: `// FilterMenu's list carries filterMenuKeys(), so ↑↓ move and Enter picks while focus stays in the filter.\n${preview.code}`,
	render: preview.render,
};
