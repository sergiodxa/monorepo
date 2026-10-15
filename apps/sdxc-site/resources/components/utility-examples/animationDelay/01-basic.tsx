/**
 * The opening `animationDelay` example: three tiles running one bounce, each starting
 * a little later, the stagger a typing indicator or a loading row uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animationDelay, animationHost, keyframes } from "@sdxc/u/animation";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One bounce staggered across three tiles by growing delays. */
export default {
	title: "Basic example",
	description:
		'Use `animationDelay()` with a CSS time, like `animationDelay("150ms")`, to start an element\'s animation later and stagger a group:',
	render: () => (
		<div
			mix={[
				keyframes("bounce", {
					"0%, 100%": { translate: "0 0" },
					"50%": { translate: "0 -1.5rem" },
				}),
				demo.gallery(),
			]}
		>
			{["0ms", "150ms", "300ms"].map((delay) => (
				<div
					mix={[
						animationHost("bounce", { duration: "900ms", iterationCount: "infinite" }),
						animationDelay(delay),
						demo.tile(),
					]}
				>
					{delay}
				</div>
			))}
		</div>
	),
} satisfies UtilityExampleModule;
