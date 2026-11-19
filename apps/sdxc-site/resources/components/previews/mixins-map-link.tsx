/**
 * Live demo for `mapLink()`: each listing row carries the mixin with its stay's id, and the pin
 * sharing that id lights while the row is pointed at or focused, and the row while the pin is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import preview from "~/resources/components/previews/mixins-map-links";

/** What the preview registry reads: the rows and pins carrying the mixin, and their source. */
export default {
	code: `// Each row and pin carries mapLink(stay.id), so a row lights its pin and the reverse.\n${preview.code}`,
	render: preview.render,
};
