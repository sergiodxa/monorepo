/**
 * A `transition` example at three durations, so the reader can hover each button and
 * feel how the `duration` option paces the same change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "sdxc/u/effects";
import { hover } from "sdxc/u/state";
import { scale } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One hover change at three durations. */
export default {
	title: "Setting the duration",
	description:
		"Pass `duration` in milliseconds, or as a CSS time string, to slow the transition down or speed it up. Hover each button:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<button
				type="button"
				mix={[transition("transform", { duration: 150 }), hover(scale(1.2)), demo.button()]}
			>
				150
			</button>
			<button
				type="button"
				mix={[transition("transform", { duration: 500 }), hover(scale(1.2)), demo.button()]}
			>
				500
			</button>
			<button
				type="button"
				mix={[transition("transform", { duration: "1s" }), hover(scale(1.2)), demo.button()]}
			>
				1s
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
