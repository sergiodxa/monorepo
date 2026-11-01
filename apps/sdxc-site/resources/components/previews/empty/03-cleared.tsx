/**
 * Live example for a cleared `Empty`: the work is done, so it says so and asks for
 * nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Empty } from "@sdxc/ui/app/empty";

/** The source the page shows, matching the markup below. */
const CODE = `<Empty kind="cleared">
	<Empty.Title>All caught up</Empty.Title>
	<Empty.Description>No open incidents. New ones land here as they start.</Empty.Description>
</Empty>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "All caught up",
	code: CODE,
	render: () => (
		<Empty kind="cleared">
			<Empty.Title>All caught up</Empty.Title>
			<Empty.Description>No open incidents. New ones land here as they start.</Empty.Description>
		</Empty>
	),
};
