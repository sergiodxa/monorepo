/**
 * A `scale` example with percentages, which pass through unchanged, for a reader who
 * thinks of a size change as a share of the original.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scale } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Uniform scaling from a percentage string. */
export default {
	title: "Using percentages",
	description: 'Pass a string to scale by a percentage, like `scale("50%")`:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scale("50%"), demo.tile()]}>scale("50%")</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scale("110%"), demo.tile()]}>scale("110%")</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
