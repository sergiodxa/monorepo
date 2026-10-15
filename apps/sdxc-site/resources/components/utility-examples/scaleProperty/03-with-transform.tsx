/**
 * A `scaleProperty` example beside a transform utility, which shows the two apply
 * together: the `scale` property never overwrites the composed `transform`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rotate, scaleProperty } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The `scale` property applied alongside a composed rotation. */
export default {
	title: "Combining with transforms",
	description:
		"The `scale` property applies on top of `transform`, so `scaleProperty()` combines with `rotate()` and the other transform utilities:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scaleProperty(0.75), rotate(20), demo.tile()]}>both</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
