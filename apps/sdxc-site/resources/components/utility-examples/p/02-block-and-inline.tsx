/**
 * A `p` example with two values, which pad the block axis and the inline axis apart, so
 * a reader sees how one call sets vertical and horizontal padding in writing order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Block then inline padding, from two steps of the spacing scale. */
export default {
	title: "Block and inline padding",
	description: "Pass two values to pad the block axis and then the inline axis, like `p(4, 10)`:",
	render: () => (
		<div mix={[p(4, 10), demo.stripes()]}>
			<div mix={[demo.block()]}>p(4, 10)</div>
		</div>
	),
} satisfies UtilityExampleModule;
