/**
 * An `insBottom` example with `"full"`, which raises a tooltip right above the button it
 * describes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insBottom, insLeft, relative } from "@sdxc/u/layout";
import { mbe, pbs } from "@sdxc/u/size";
import { nowrap } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A bottom offset of the parent's full height lifts a tooltip right over its trigger. */
export default {
	title: "Placing above the parent",
	description:
		'Use `insBottom("full")` to place an element right above its positioned parent, like a tooltip over its button:',
	render: () => (
		<div mix={[pbs(14)]}>
			<div mix={[relative()]}>
				<button type="button" mix={[demo.button()]}>
					Share
				</button>
				<div mix={[absolute(), insBottom("full"), insLeft(0), mbe(2), nowrap(), demo.block()]}>
					Copy the link
				</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
