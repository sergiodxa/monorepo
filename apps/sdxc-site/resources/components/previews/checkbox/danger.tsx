/**
 * Live example for a `Checkbox` in the danger color, the box a table row uses to flag a
 * record. The native checkbox toggles and submits on its own, so the example is plain
 * server markup that needs no island of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { Checkbox, Text } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[hstack({ gap: 3, align: "center" })]}>
	<Checkbox color="danger" name="flagged" value="INV-1042" checked aria-label="Flag invoice INV-1042" />
	<Text>INV-1042 · Acme Design · $1,280.00</Text>
</div>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Danger color",
	code: CODE,
	render: () => (
		<div mix={[hstack({ gap: 3, align: "center" })]}>
			<Checkbox
				color="danger"
				name="flagged"
				value="INV-1042"
				checked
				aria-label="Flag invoice INV-1042"
			/>
			<Text>INV-1042 · Acme Design · $1,280.00</Text>
		</div>
	),
};
