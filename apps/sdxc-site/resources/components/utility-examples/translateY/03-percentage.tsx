/**
 * A `translateY` example with a raw CSS length, where a percentage is a share of the
 * element's own height.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { translateY } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Vertical translation by a share of the element's own height. */
export default {
	title: "Using percentages and lengths",
	description:
		'Pass a string for any CSS length; a percentage like `translateY("-25%")` is a share of the element\'s own height:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[translateY("-25%"), demo.tile()]}>translateY("-25%")</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[translateY("12px"), demo.tile()]}>translateY("12px")</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
