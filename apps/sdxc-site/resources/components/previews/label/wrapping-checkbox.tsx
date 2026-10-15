/**
 * Live example for a `Label` wrapping its checkbox. Nesting the control is what pairs the
 * two, so clicking the caption toggles the box with no `id`, no `htmlFor` and no script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { Label } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Label mix={[hstack({ gap: 2, align: "center" })]}>
	Email me product updates from Acme
	<input type="checkbox" name="newsletter" />
</Label>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Wrapping its control",
	code: CODE,
	render: () => (
		<Label mix={[hstack({ gap: 2, align: "center" })]}>
			Email me product updates from Acme
			<input type="checkbox" name="newsletter" />
		</Label>
	),
};
