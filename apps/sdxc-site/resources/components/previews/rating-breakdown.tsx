/**
 * Live preview for `RatingBreakdown`: a cabin stay's 4.86 average from 128 reviews, the
 * share of reviews at each star level, and six category scores that run two to a row
 * once the summary has room.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	CircleCheckIcon,
	KeyRoundIcon,
	MapPinIcon,
	MessageCircleIcon,
	SparklesIcon,
	TagIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { RatingBreakdown } from "@sdxc/ui/rating-breakdown";

/** The source the page shows, matching the markup below. */
const CODE = `<RatingBreakdown score={4.86} count="128 reviews">
	<RatingBreakdown.Group kind="stars" aria-label="Ratings by star">
		{stars.map((star) => (
			<RatingBreakdown.Bar label={\`\${star.level} stars\`} value={star.share} display={star.percent} />
		))}
	</RatingBreakdown.Group>
	<RatingBreakdown.Group kind="categories" aria-label="Ratings by category">
		<RatingBreakdown.Bar label="Cleanliness" icon={<SparklesIcon />} value={4.9} display="4.9" />
		<RatingBreakdown.Bar label="Location" icon={<MapPinIcon />} value={4.7} display="4.7" />
	</RatingBreakdown.Group>
</RatingBreakdown>`;

/** Share of the 128 reviews at each star level, five stars first. */
const STARS = [
	{ level: 5, share: 0.89 },
	{ level: 4, share: 0.08 },
	{ level: 3, share: 0.02 },
	{ level: 2, share: 0.01 },
	{ level: 1, share: 0 },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "40rem", paddingBlock: "1.5rem" })]}>
			<RatingBreakdown score={4.86} count="128 reviews">
				<RatingBreakdown.Group kind="stars" aria-label="Ratings by star">
					{STARS.map((star) => (
						<RatingBreakdown.Bar
							label={star.level === 1 ? "1 star" : `${star.level} stars`}
							value={star.share}
							display={`${Math.round(star.share * 100)}%`}
						/>
					))}
				</RatingBreakdown.Group>
				<RatingBreakdown.Group kind="categories" aria-label="Ratings by category">
					<RatingBreakdown.Bar
						label="Cleanliness"
						icon={<SparklesIcon />}
						value={4.9}
						display="4.9"
					/>
					<RatingBreakdown.Bar
						label="Accuracy"
						icon={<CircleCheckIcon />}
						value={4.9}
						display="4.9"
					/>
					<RatingBreakdown.Bar label="Check-in" icon={<KeyRoundIcon />} value={5} display="5.0" />
					<RatingBreakdown.Bar
						label="Communication"
						icon={<MessageCircleIcon />}
						value={4.8}
						display="4.8"
					/>
					<RatingBreakdown.Bar label="Location" icon={<MapPinIcon />} value={4.7} display="4.7" />
					<RatingBreakdown.Bar label="Value" icon={<TagIcon />} value={4.6} display="4.6" />
				</RatingBreakdown.Group>
			</RatingBreakdown>
		</div>
	),
};
