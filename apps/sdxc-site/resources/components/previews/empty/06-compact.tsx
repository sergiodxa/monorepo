/**
 * Live example for a compact `Empty` inside a card: the tighter size keeps a dashboard
 * panel with nothing to show as small as the panel around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Card } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";

/** The source the page shows, matching the markup below. */
const CODE = `<Card>
	<Card.Content>
		<Empty kind="cleared" size="compact">
			<Empty.Title>No failing checks</Empty.Title>
			<Empty.Description>Every monitor answered in the last hour.</Empty.Description>
		</Empty>
	</Card.Content>
</Card>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Compact, inside a card",
	code: CODE,
	render: () => (
		<Card>
			<Card.Content>
				<Empty kind="cleared" size="compact">
					<Empty.Title>No failing checks</Empty.Title>
					<Empty.Description>Every monitor answered in the last hour.</Empty.Description>
				</Empty>
			</Card.Content>
		</Card>
	),
};
