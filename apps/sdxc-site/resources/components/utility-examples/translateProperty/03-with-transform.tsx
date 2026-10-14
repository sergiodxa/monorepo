/**
 * A `translateProperty` example beside a transform utility, which shows the two apply
 * together: `translate` moves the element and `transform` still turns it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rotate, translateProperty } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The `translate` property applied alongside a composed rotation. */
export default {
	title: "Combining with transforms",
	description:
		"The `translate` property applies before `transform`, so `translateProperty()` combines with `rotate()` and the other transform utilities:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[translateProperty("1rem 0"), rotate(15), demo.tile()]}>both</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
