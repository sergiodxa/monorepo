/**
 * Live example for a first-run `Empty`: nothing created yet, so it welcomes the reader
 * and offers the one action that creates the first record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";

/** The source the page shows, matching the markup below. */
const CODE = `<Empty kind="first-run">
	<Empty.Title>Create your first monitor</Empty.Title>
	<Empty.Description>
		Monitors check a URL every minute and tell you when it stops answering.
	</Empty.Description>
	<Empty.Action>
		<Button>Create Monitor</Button>
	</Empty.Action>
</Empty>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "First run",
	code: CODE,
	render: () => (
		<Empty kind="first-run">
			<Empty.Title>Create your first monitor</Empty.Title>
			<Empty.Description>
				Monitors check a URL every minute and tell you when it stops answering.
			</Empty.Description>
			<Empty.Action>
				<Button>Create Monitor</Button>
			</Empty.Action>
		</Empty>
	),
};
