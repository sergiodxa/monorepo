/**
 * Live example for a `CheckboxGroup` laid out in a row, the shape a short set of channels
 * takes. Each box toggles and submits natively, so the example is plain server markup that
 * needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Checkbox, CheckboxGroup } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<CheckboxGroup aria-label="Notify me by" orientation="horizontal">
	<Checkbox name="notify" value="email" defaultChecked>Email</Checkbox>
	<Checkbox name="notify" value="sms">SMS</Checkbox>
	<Checkbox name="notify" value="push">Push</Checkbox>
</CheckboxGroup>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Horizontal",
	code: CODE,
	render: () => (
		<CheckboxGroup aria-label="Notify me by" orientation="horizontal">
			<Checkbox name="notify" value="email" defaultChecked>
				Email
			</Checkbox>
			<Checkbox name="notify" value="sms">
				SMS
			</Checkbox>
			<Checkbox name="notify" value="push">
				Push
			</Checkbox>
		</CheckboxGroup>
	),
};
