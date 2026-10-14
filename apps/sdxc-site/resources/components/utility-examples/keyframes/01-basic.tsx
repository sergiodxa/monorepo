/**
 * The opening `keyframes` example: a `@keyframes` rule emitted on its own and run by
 * the element it sits on, with `from` and `to` stops.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animationHost, keyframes } from "@sdxc/u/animation";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A fade between two stops, run on the same element. */
export default {
	title: "Basic example",
	description:
		"Use `keyframes(name, frames)` to declare a `@keyframes` rule with `from` and `to` stops, and run it by name with `animationHost()`:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div
				mix={[
					keyframes("fade", { from: { opacity: 1 }, to: { opacity: 0.2 } }),
					animationHost("fade", {
						duration: "1s",
						iterationCount: "infinite",
						direction: "alternate",
					}),
					demo.tile(),
				]}
			>
				fade
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
