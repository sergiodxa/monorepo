/**
 * A `vstack` example with `justify`: a fixed-height card whose heading sits at the top
 * and whose action sits at the bottom.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";
import { weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The justify option pushes a card's first and last children to its two ends. */
export default {
	title: "Justifying items",
	description:
		'Use the `justify` option to distribute items down the column, like `justify: "between"` to pin an action to the bottom of a card:',
	render: () => (
		<div mix={[vstack({ justify: "between", align: "start" }), is(64), bs(40), demo.panel()]}>
			<span mix={[weight("semibold")]}>Weekly report</span>
			<button type="button" mix={[demo.button()]}>
				Download
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
