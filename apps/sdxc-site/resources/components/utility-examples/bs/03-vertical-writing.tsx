/**
 * A `bs` example in two writing modes: the same call sizes the height of horizontal text
 * and the width of vertical text, because it follows the block axis.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "sdxc/u/general";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Block size follows the writing mode. */
export default {
	title: "Vertical writing modes",
	description:
		"`bs()` sizes the block axis, so in a vertical writing mode like `vertical-rl` it sets the element's width instead of its height:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[bs(16), is(40), demo.cell()]}>horizontal-tb</div>
			<div mix={[bs(16), is(40), raw({ writingMode: "vertical-rl" }), demo.cell()]}>
				vertical-rl
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
