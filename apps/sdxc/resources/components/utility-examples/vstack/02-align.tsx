/**
 * A `vstack` example with `align`: items of three widths centred on the column's
 * horizontal axis instead of stretched across it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The align option places items of different widths on the horizontal axis. */
export default {
	title: "Aligning items",
	description:
		'Use the `align` option to place items on the horizontal axis, like `align: "center"`:',
	render: () => (
		<div mix={[vstack({ gap: 4, align: "center" }), is(64), demo.stripes()]}>
			<div mix={[is(20), demo.block()]}>01</div>
			<div mix={[is(40), demo.block()]}>02</div>
			<div mix={[is(28), demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
