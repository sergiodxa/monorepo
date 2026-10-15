/**
 * The opening `conicGradient` example: colors swept around a center point, which draws a
 * color wheel no linear or radial gradient can.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, conicGradient } from "@sdxc/u/color";
import { bs, circle, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A color wheel swept around its center. */
export default {
	title: "Basic example",
	description:
		"Use `conicGradient` with a starting angle and two or more colors to sweep colors around a center point:",
	render: () => (
		<div
			mix={[
				bg({
					image: conicGradient(
						0,
						"var(--ui-color-danger-500)",
						"var(--ui-color-warning-400)",
						"var(--ui-color-success-500)",
						"var(--ui-color-brand-500)",
						"var(--ui-color-danger-500)",
					),
				}),
				circle(),
				is(32),
				bs(32),
			]}
		/>
	),
} satisfies UtilityExampleModule;
