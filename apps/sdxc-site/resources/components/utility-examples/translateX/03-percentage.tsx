/**
 * A `translateX` example with a raw CSS length, where a percentage is a share of the
 * element's own width, the unit behind sliding panels and centring.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { translateX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Horizontal translation by a share of the element's own width. */
export default {
	title: "Using percentages and lengths",
	description:
		'Pass a string for any CSS length; a percentage like `translateX("50%")` is a share of the element\'s own width:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[translateX("50%"), demo.tile()]}>translateX("50%")</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[translateX("12px"), demo.tile()]}>translateX("12px")</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
