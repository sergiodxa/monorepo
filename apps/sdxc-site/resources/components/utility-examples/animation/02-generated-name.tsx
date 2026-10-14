/**
 * An `animation` example without a name, where the rule is named from a hash of its
 * keyframes, so one-off animations with the same frames share one rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation } from "@sdxc/u/animation";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A pulse whose keyframes rule is named from its content. */
export default {
	title: "Generating the name",
	description:
		"Leave the name out and pass only the config, and a stable name is generated from the keyframes:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div
				mix={[
					animation({
						keyframes: { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.4 } },
						duration: "2s",
						easing: "ease-in-out",
						iterationCount: "infinite",
					}),
					demo.tile(),
				]}
			>
				pulse
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
