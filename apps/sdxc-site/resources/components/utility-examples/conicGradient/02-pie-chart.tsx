/**
 * A `conicGradient` example with hard stops, two stops sharing each position, which
 * turns the sweep into the slices of a pie chart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, conicGradient } from "@sdxc/u/color";
import { bs, circle, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A pie chart drawn from hard stops. */
export default {
	title: "Pie charts",
	description:
		"Place each stop with a start and an end position, like `0% 40%`, to draw hard-edged slices:",
	render: () => (
		<div
			mix={[
				bg({
					image: conicGradient(
						0,
						{ color: "var(--ui-color-brand-500)", position: "0% 40%" },
						{ color: "var(--ui-color-success-500)", position: "40% 75%" },
						{ color: "var(--ui-color-warning-400)", position: "75% 100%" },
					),
				}),
				circle(),
				is(32),
				bs(32),
			]}
		/>
	),
} satisfies UtilityExampleModule;
