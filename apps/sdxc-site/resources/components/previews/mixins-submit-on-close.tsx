/**
 * Live demo for `submitOnClose()`: a label picker that posts its checked labels once, when its
 * popover closes having changed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import preview from "~/resources/components/previews/filter-menu/01-labels";

/** What the preview registry reads: the component carrying the mixin, and its source. */
export default {
	code: `// FilterMenu's form carries submitOnClose(), so the labels post once when the popover closes.\n${preview.code}`,
	render: preview.render,
};
