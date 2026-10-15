/**
 * An `items` example with `"stretch"`: items with no height of their own fill the row's
 * full cross size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, gap, items } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Stretch makes every item as tall as the container. */
export default {
	title: "Stretch",
	description: 'Use `items("stretch")` to stretch items to fill the container\'s cross axis:',
	render: () => (
		<div mix={[flex(), gap(4), items("stretch"), is(80), bs(36), demo.stripes()]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
