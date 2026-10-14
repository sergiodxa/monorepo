/**
 * Live example for a `Card` in the danger color. The color tints the card's surface and
 * border, so a header alone is enough to flag a problem among neutral cards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Card } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Card color="danger">
	<Card.Header>
		<Card.Title>Your last payment did not go through</Card.Title>
	</Card.Header>
</Card>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Danger color",
	code: CODE,
	render: () => (
		<Card color="danger">
			<Card.Header>
				<Card.Title>Your last payment did not go through</Card.Title>
			</Card.Header>
		</Card>
	),
};
