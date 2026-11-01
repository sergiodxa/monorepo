/**
 * Live example for a no-results `Empty`: it quotes the query so the reader sees what to
 * change, and offers Clear filters. It drops its frame to sit inside the list box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";

/** The source the page shows, matching the markup below. */
const CODE = `<Empty kind="no-results">
	<Empty.Title>No monitors match</Empty.Title>
	<Empty.Description>
		Nothing matched <Empty.Query>status:down region:fra</Empty.Query>. Try another region.
	</Empty.Description>
	<Empty.Action>
		<Button variant="outline">Clear filters</Button>
	</Empty.Action>
</Empty>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "No results",
	code: CODE,
	render: () => (
		<Empty kind="no-results">
			<Empty.Title>No monitors match</Empty.Title>
			<Empty.Description>
				Nothing matched <Empty.Query>status:down region:fra</Empty.Query>. Try another region.
			</Empty.Description>
			<Empty.Action>
				<Button variant="outline">Clear filters</Button>
			</Empty.Action>
		</Empty>
	),
};
