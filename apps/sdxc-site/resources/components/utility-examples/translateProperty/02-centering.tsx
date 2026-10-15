/**
 * A `translateProperty` example that centres an absolutely positioned badge on a corner,
 * the job `-50% -50%` does: pull the element back by half its own size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insRight, insTop, relative } from "@sdxc/u/layout";
import { translateProperty } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A badge centred on its parent's corner by pulling it back half its size. */
export default {
	title: "Centring on a point",
	description:
		"A percentage is a share of the element's own size, so `translateProperty(\"50% -50%\")` centres an absolutely positioned badge on its parent's corner:",
	render: () => (
		<div mix={[relative(), demo.tile()]}>
			Inbox
			<span mix={[absolute(), insTop(0), insRight(0), translateProperty("50% -50%"), demo.block()]}>
				3
			</span>
		</div>
	),
} satisfies UtilityExampleModule;
