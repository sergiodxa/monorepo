/**
 * An `hstack` example with `align`: items of three heights centred on the row's cross
 * axis.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { bs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The align option places items of different heights on the vertical axis. */
export default {
	title: "Aligning items",
	description:
		'Use the `align` option to place items on the vertical axis, like `align: "center"`:',
	render: () => (
		<div mix={[hstack({ gap: 4, align: "center" }), demo.stripes()]}>
			<div mix={[bs(12), demo.block()]}>01</div>
			<div mix={[bs(24), demo.block()]}>02</div>
			<div mix={[bs(16), demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
