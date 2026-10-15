/**
 * An `is` example in two writing modes: the same call sizes the width of horizontal text
 * and the height of vertical text, because it follows the inline axis.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Inline size follows the writing mode. */
export default {
	title: "Vertical writing modes",
	description:
		"`is()` sizes the inline axis, so in a vertical writing mode like `vertical-rl` it sets the element's height instead of its width:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[is(40), bs(16), demo.cell()]}>horizontal-tb</div>
			<div mix={[is(40), bs(16), raw({ writingMode: "vertical-rl" }), demo.cell()]}>
				vertical-rl
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
