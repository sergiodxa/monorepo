/**
 * Live example for `Switch` nested in a `Label` that captions it first. Nesting associates
 * the caption with the control natively, so clicking the text toggles the switch before
 * any script loads and the example needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Label, Switch } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Label>
	Email me when a deploy fails
	<Switch name="deployAlerts" defaultChecked />
</Label>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Caption before the switch",
	code: CODE,
	render: () => (
		<Label>
			Email me when a deploy fails
			<Switch name="deployAlerts" defaultChecked />
		</Label>
	),
};
