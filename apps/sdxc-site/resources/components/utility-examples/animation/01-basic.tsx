/**
 * The opening `animation` example: a tile spinning forever from one call that emits
 * the `@keyframes` rule and the `animation-*` declarations that run it together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation } from "sdxc/u/animation";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A named, endlessly repeating spin. */
export default {
	title: "Basic example",
	description:
		'Use `animation(name, config)` with `keyframes` and a `duration` to animate an element; `iterationCount: "infinite"` keeps it running:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div
				mix={[
					animation("spin", {
						keyframes: { from: { rotate: "0deg" }, to: { rotate: "360deg" } },
						duration: "1s",
						easing: "linear",
						iterationCount: "infinite",
					}),
					demo.tile(),
				]}
			>
				spin
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
