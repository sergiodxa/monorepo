/**
 * The opening `transitionDelay` example: three buttons with the same hover change after
 * three delays, so the reader can hover each and feel the wait.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition, transitionDelay } from "@sdxc/u/effects";
import { hover } from "@sdxc/u/state";
import { scale } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One hover change after three delays. */
export default {
	title: "Basic example",
	description:
		'Use `transitionDelay(time)` to wait before a transition starts, with a CSS time like `"150ms"`. Hover each button:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<button
				type="button"
				mix={[
					transition("transform", { duration: 300 }),
					transitionDelay("0s"),
					hover(scale(1.2)),
					demo.button(),
				]}
			>
				0s
			</button>
			<button
				type="button"
				mix={[
					transition("transform", { duration: 300 }),
					transitionDelay("150ms"),
					hover(scale(1.2)),
					demo.button(),
				]}
			>
				150ms
			</button>
			<button
				type="button"
				mix={[
					transition("transform", { duration: 300 }),
					transitionDelay("500ms"),
					hover(scale(1.2)),
					demo.button(),
				]}
			>
				500ms
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
