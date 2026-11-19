/**
 * Live preview for `RatingInput`: the star question of a review form, already answered with
 * four stars; hover previews another score and the arrow keys step along the scale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RatingInput } from "@sdxc/ui";

/** The source the page shows. */
const CODE = `<form method="post" action="/reviews">
	<RatingInput
		name="rating"
		legend="How would you rate this print?"
		value={4}
		required
		labels={["1 star — Poor", "2 stars — Fair", "3 stars — Good", "4 stars — Great", "5 stars — Excellent"]}
	/>
</form>`;

/** One name per star, lowest first. */
const LABELS = [
	"1 star — Poor",
	"2 stars — Fair",
	"3 stars — Good",
	"4 stars — Great",
	"5 stars — Excellent",
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<form method="post" action="#review">
			<RatingInput
				name="rating"
				legend="How would you rate this print?"
				value={4}
				required
				labels={LABELS}
			/>
		</form>
	),
};
