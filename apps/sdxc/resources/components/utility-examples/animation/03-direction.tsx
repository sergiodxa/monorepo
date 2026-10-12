/**
 * An `animation` example with `direction: "alternate"`, which plays every other cycle
 * backwards so a back-and-forth motion needs keyframes for one way only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation } from "@sdxc/u/animation";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A sway that plays forwards then backwards. */
export default {
	title: "Alternating direction",
	description:
		'Set `direction: "alternate"` to play every other cycle in reverse, so keyframes written one way swing back and forth:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div
				mix={[
					animation("sway", {
						keyframes: { from: { translate: "-2rem 0" }, to: { translate: "2rem 0" } },
						duration: "800ms",
						easing: "ease-in-out",
						iterationCount: "infinite",
						direction: "alternate",
					}),
					demo.tile(),
				]}
			>
				sway
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
