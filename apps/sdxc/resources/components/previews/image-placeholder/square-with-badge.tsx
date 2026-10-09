/**
 * Live example for a large, square `ImagePlaceholder` with a corner badge. The square shape
 * suits a brand mark, and the badge stays round and unclipped on the corner whatever the
 * host's shape; the image is a data URI, so the example fetches nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ImagePlaceholder } from "@sdxc/ui";

/** An organization mark drawn as a data URI, so the example fetches nothing to render. */
const MARK =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%230f766e'/%3E%3Cpath d='M2 6 4 2l2 4z' fill='%23fff'/%3E%3C/svg%3E";

/** The source the page shows, matching the markup below. */
const CODE = `<ImagePlaceholder size="lg" shape="square">
	<ImagePlaceholder.Image src={MARK} alt="Acme" />
	<ImagePlaceholder.Badge />
</ImagePlaceholder>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Square with a badge",
	code: CODE,
	render: () => (
		<ImagePlaceholder size="lg" shape="square">
			<ImagePlaceholder.Image src={MARK} alt="Acme" />
			<ImagePlaceholder.Badge />
		</ImagePlaceholder>
	),
};
