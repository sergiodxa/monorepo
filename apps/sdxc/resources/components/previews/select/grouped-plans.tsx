/**
 * Live example for `Select` with a trigger and grouped options. `Select.Trigger` opts the
 * field into the customizable-select rendering, and native `<optgroup>`s label each run of
 * plans, so the picker works before any script loads and needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Select } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Select aria-label="Plan" name="plan" color="brand">
	<Select.Trigger />
	<Select.Group label="Personal">
		<Select.Option value="free">Free</Select.Option>
		<Select.Option value="pro" selected>Pro</Select.Option>
	</Select.Group>
	<Select.Group label="Business">
		<Select.Option value="team">Team</Select.Option>
		<Select.Option value="enterprise">Enterprise</Select.Option>
	</Select.Group>
</Select>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Grouped options with a trigger",
	code: CODE,
	render: () => (
		<Select aria-label="Plan" name="plan" color="brand">
			<Select.Trigger />
			<Select.Group label="Personal">
				<Select.Option value="free">Free</Select.Option>
				<Select.Option value="pro" selected>
					Pro
				</Select.Option>
			</Select.Group>
			<Select.Group label="Business">
				<Select.Option value="team">Team</Select.Option>
				<Select.Option value="enterprise">Enterprise</Select.Option>
			</Select.Group>
		</Select>
	),
};
