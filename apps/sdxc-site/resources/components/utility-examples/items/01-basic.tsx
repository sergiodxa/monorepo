/**
 * The opening `items` example: three items of different heights centred on the row's
 * cross axis.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, gap, items } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Centring aligns items of different heights on the row's middle line. */
export default {
	title: "Basic example",
	description:
		'Use `items("center")` to align items along the center of the container\'s cross axis:',
	render: () => (
		<div mix={[flex(), gap(4), items("center"), is(80), bs(36), demo.stripes()]}>
			<div mix={[bs(12), demo.block()]}>01</div>
			<div mix={[bs(24), demo.block()]}>02</div>
			<div mix={[bs(16), demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
