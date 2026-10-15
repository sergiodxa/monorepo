/**
 * An `fg` example walking one tone through its text weights, so a reader sees what
 * `muted`, the bare tone and `emphasis` each resolve to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One tone at its muted, plain and emphasis text weights. */
export default {
	title: "Text weights",
	description:
		"A bare tone resolves its plain `fg` weight; add `muted` or `emphasis` for a softer or a stronger one:",
	render: () => (
		<div mix={[demo.stack()]}>
			<p mix={[fg("danger.muted"), demo.prose()]}>fg("danger.muted")</p>
			<p mix={[fg("danger"), demo.prose()]}>fg("danger")</p>
			<p mix={[fg("danger.emphasis"), demo.prose()]}>fg("danger.emphasis")</p>
		</div>
	),
} satisfies UtilityExampleModule;
