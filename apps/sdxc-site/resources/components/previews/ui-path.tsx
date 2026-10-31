/**
 * Live preview for `UiPath`: where to click, in order, to add an alert channel, a path
 * that wraps between its steps on a phone and keeps every chip whole.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { m } from "@sdxc/u/size";
import { UiPath } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<p>
	Go to <UiPath items={["Settings", "Notifications", "Add channel"]} /> and pick Slack.
</p>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<p mix={[m(0)]}>
			Go to <UiPath items={["Settings", "Notifications", "Add channel"]} /> and pick Slack.
		</p>
	),
};
