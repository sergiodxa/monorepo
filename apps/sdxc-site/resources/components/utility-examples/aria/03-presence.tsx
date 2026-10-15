/**
 * An `aria` example with the two-argument form, which matches the attribute whatever its
 * value, so the reader sees a busy region faded while it reloads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { opacity } from "sdxc/u/effects";
import { cursor } from "sdxc/u/general";
import { aria } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Half opacity and a progress cursor on the panel that has `aria-busy` at all. */
export default {
	title: "Matching any value",
	description:
		"Leave out the value to match the attribute whenever it is present, like a panel with `aria-busy`:",
	render: () => (
		<div mix={[demo.row()]}>
			<section mix={[aria("busy", [opacity(50), cursor("progress")]), demo.panel()]}>
				Up to date
			</section>
			<section
				aria-busy="true"
				mix={[aria("busy", [opacity(50), cursor("progress")]), demo.panel()]}
			>
				Refreshing…
			</section>
		</div>
	),
} satisfies UtilityExampleModule;
