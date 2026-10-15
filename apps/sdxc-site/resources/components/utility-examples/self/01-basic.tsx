/**
 * The opening `self` example: a row that stretches its items, with one item centring
 * itself instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, gap, items, self } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One item overrides the alignment its container gives every item. */
export default {
	title: "Basic example",
	description:
		'Use `self("center")` to align one item along the center of the cross axis, whatever its container\'s `items`:',
	render: () => (
		<div mix={[flex(), gap(4), items("stretch"), is(80), bs(36), demo.stripes()]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[self("center"), demo.block()]}>self("center")</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
