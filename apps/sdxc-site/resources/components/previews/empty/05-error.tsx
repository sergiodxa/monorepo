/**
 * Live example for an error `Empty` in place of the region that failed: Retry, and a
 * request id that selects whole on one click for a support message.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";

/** The source the page shows, matching the markup below. */
const CODE = `<Empty kind="error">
	<Empty.Title>Couldn't load incidents</Empty.Title>
	<Empty.Description>The server took too long to answer. Try again.</Empty.Description>
	<Empty.Action>
		<Button variant="outline">Retry</Button>
	</Empty.Action>
	<Empty.RequestId label="Request ID">req_01JD8Z3K4R7Y2M</Empty.RequestId>
</Empty>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Error",
	code: CODE,
	render: () => (
		<Empty kind="error">
			<Empty.Title>Couldn't load incidents</Empty.Title>
			<Empty.Description>The server took too long to answer. Try again.</Empty.Description>
			<Empty.Action>
				<Button variant="outline">Retry</Button>
			</Empty.Action>
			<Empty.RequestId label="Request ID">req_01JD8Z3K4R7Y2M</Empty.RequestId>
		</Empty>
	),
};
