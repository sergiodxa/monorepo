/**
 * A `backdropBlur` example combined with sibling backdrop utilities into frosted glass,
 * so the reader sees every backdrop utility add its own step to one backdrop filter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropBlur, backdropBrightness, backdropSaturate } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Blur, saturation and brightness combined into one frosted pane. */
export default {
	title: "Frosted glass",
	description:
		"Every backdrop utility writes its own part of one `backdrop-filter`, so `backdropBlur()` stacks with `backdropSaturate()` and `backdropBrightness()` into frosted glass:",
	render: () => (
		<div mix={[demo.scene()]}>
			<div mix={[backdropBlur("md"), backdropSaturate(1.8), backdropBrightness(1.15), demo.pane()]}>
				frosted glass
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
