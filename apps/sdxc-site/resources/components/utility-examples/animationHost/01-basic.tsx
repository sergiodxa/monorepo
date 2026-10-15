/**
 * The opening `animationHost` example: the `animation-*` declarations set apart from
 * the `@keyframes` rule they run, paired with a sibling `keyframes()` call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animationHost, keyframes } from "sdxc/u/animation";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A spin whose keyframes and host declarations are set by separate calls. */
export default {
	title: "Basic example",
	description:
		"Use `animationHost(name, config)` to run a `@keyframes` rule declared elsewhere, like one from `keyframes()`:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div
				mix={[
					keyframes("spin", { from: { rotate: "0deg" }, to: { rotate: "360deg" } }),
					animationHost("spin", { duration: "1s", easing: "linear", iterationCount: "infinite" }),
					demo.tile(),
				]}
			>
				spin
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
