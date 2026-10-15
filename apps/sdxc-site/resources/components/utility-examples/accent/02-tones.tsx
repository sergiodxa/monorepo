/**
 * An `accent` example across the status tones, each a checked checkbox, so a reader sees
 * a tone resolve to its solid background weight.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { accent } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Checkboxes in three status tones. */
export default {
	title: "Tones",
	description:
		"Pass a tone, like `success` or `danger`, to paint a control in that tone's solid color:",
	render: () => (
		<div mix={[demo.row()]}>
			<input type="checkbox" checked mix={[accent("success")]} aria-label="Success" />
			<input type="checkbox" checked mix={[accent("warning")]} aria-label="Warning" />
			<input type="checkbox" checked mix={[accent("danger")]} aria-label="Danger" />
			<input type="range" mix={[accent("danger")]} aria-label="Danger range" />
		</div>
	),
} satisfies UtilityExampleModule;
