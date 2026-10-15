/**
 * An `mi` example centring a fixed-width box: an automatic inline margin splits the free
 * space evenly on both sides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, mi } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Automatic inline margin centres a box with a width. */
export default {
	title: "Centering with auto",
	description: 'Use `mi("auto")` to center an element that has a width inside its container:',
	align: "stretch",
	render: () => (
		<div mix={[demo.track()]}>
			<div mix={[mi("auto"), is(64), demo.block()]}>mi("auto")</div>
		</div>
	),
} satisfies UtilityExampleModule;
