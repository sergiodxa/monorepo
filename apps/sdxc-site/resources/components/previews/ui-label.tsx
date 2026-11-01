/**
 * Live preview for `UiLabel`: a help-doc sentence that names the buttons a reader has to
 * find, each as a chip that reads as something on screen rather than as code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { m } from "@sdxc/u/size";
import { UiLabel } from "@sdxc/ui/docs";

/** The source the page shows, matching the markup below. */
const CODE = `<p>
	Open the monitor, click <UiLabel>Pause checks</UiLabel>, then confirm with <UiLabel>Pause</UiLabel>.
</p>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<p mix={[m(0)]}>
			Open the monitor, click <UiLabel>Pause checks</UiLabel>, then confirm with{" "}
			<UiLabel>Pause</UiLabel>.
		</p>
	),
};
