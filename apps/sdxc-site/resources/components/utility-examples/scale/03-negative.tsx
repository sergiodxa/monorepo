/**
 * A `scale` example with a negative factor, which mirrors the element through its centre
 * on both axes, turning the label upside down.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scale } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Mirroring through the centre with a negative factor. */
export default {
	title: "Using negative values",
	description: "A negative factor, like `scale(-1)`, mirrors an element on both axes:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scale(-1), demo.tile()]}>scale(-1)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scale(-0.75), demo.tile()]}>scale(-0.75)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
