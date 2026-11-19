/**
 * Live demo for `lightboxControls()`: a photo grid whose viewer opens at the photo clicked,
 * and steps through the rest with the arrow keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import preview from "~/resources/components/previews/lightbox";

/** What the preview registry reads: the component carrying the mixin, and its source. */
export default {
	code: `// Lightbox's dialog carries lightboxControls(): open a photo, then press ← and →.\n${preview.code}`,
	render: preview.render,
};
