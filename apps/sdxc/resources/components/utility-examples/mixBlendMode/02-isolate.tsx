/**
 * A `mixBlendMode` example with overlapping circles in an isolated group, so the circles
 * blend with each other while the page behind them stays out of the mix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "@sdxc/u/color";
import { mixBlendMode } from "@sdxc/u/effects";
import { hstack } from "@sdxc/u/layout";
import { circle, is, mis } from "@sdxc/u/size";
import { isolate } from "@sdxc/u/stacking";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** Overlapping circles multiplied together inside an isolated group. */
export default {
	title: "Isolating the blend",
	description:
		"Put `isolate()` on the parent so the elements blend with each other and leave the page behind them alone:",
	render: () => (
		<div mix={[isolate(), hstack({ justify: "center" })]}>
			<div mix={[mixBlendMode("multiply"), bg("color.danger.400"), circle(), is(24)]} />
			<div mix={[mixBlendMode("multiply"), bg("color.warning.400"), circle(), is(24), mis(-8)]} />
			<div mix={[mixBlendMode("multiply"), bg("color.brand.400"), circle(), is(24), mis(-8)]} />
		</div>
	),
} satisfies UtilityExampleModule;
