/**
 * Live example for a danger `Banner`: a failing integration stays on screen until it is
 * fixed, with the action that fixes it and no close control.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button } from "@sdxc/ui";
import { Banner } from "@sdxc/ui/banner";

/** The source the page shows, matching the markup below. */
const CODE = `<Banner
	color="danger"
	label="Integrations"
	action={<Button size="sm" variant="outline">Reconnect Slack</Button>}
>
	Slack stopped accepting alerts 2 hours ago. Down alerts go to email until you reconnect it.
</Banner>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Failing integration",
	code: CODE,
	render: () => (
		<Banner
			color="danger"
			label="Integrations"
			action={
				<Button size="sm" variant="outline">
					Reconnect Slack
				</Button>
			}
		>
			Slack stopped accepting alerts 2 hours ago. Down alerts go to email until you reconnect it.
		</Banner>
	),
};
