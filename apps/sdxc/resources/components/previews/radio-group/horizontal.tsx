/**
 * Live example for a `RadioGroup` laid out in a row, the shape a short set of sizes takes.
 * The group gives its options a shared native name, so the single choice works before any
 * script loads and the example needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RadioGroup } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<RadioGroup aria-label="Instance size" orientation="horizontal">
	<RadioGroup.Radio value="sm">Small</RadioGroup.Radio>
	<RadioGroup.Radio value="md" defaultChecked>Medium</RadioGroup.Radio>
	<RadioGroup.Radio value="lg">Large</RadioGroup.Radio>
</RadioGroup>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Horizontal",
	code: CODE,
	render: () => (
		<RadioGroup aria-label="Instance size" orientation="horizontal">
			<RadioGroup.Radio value="sm">Small</RadioGroup.Radio>
			<RadioGroup.Radio value="md" defaultChecked>
				Medium
			</RadioGroup.Radio>
			<RadioGroup.Radio value="lg">Large</RadioGroup.Radio>
		</RadioGroup>
	),
};
