/**
 * The opening `transitionDuration` example: three buttons with the same hover change at
 * three durations, so the reader can hover each and feel the pace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transitionDuration, transitionProperty } from "sdxc/u/effects";
import { hover } from "sdxc/u/state";
import { scale } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One hover change at three durations. */
export default {
	title: "Basic example",
	description:
		'Use `transitionDuration(time)` to set how long a transition takes, with a CSS time like `"150ms"` or `"1s"`. Hover each button:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<button
				type="button"
				mix={[
					transitionProperty("transform"),
					transitionDuration("150ms"),
					hover(scale(1.2)),
					demo.button(),
				]}
			>
				150ms
			</button>
			<button
				type="button"
				mix={[
					transitionProperty("transform"),
					transitionDuration("500ms"),
					hover(scale(1.2)),
					demo.button(),
				]}
			>
				500ms
			</button>
			<button
				type="button"
				mix={[
					transitionProperty("transform"),
					transitionDuration("1s"),
					hover(scale(1.2)),
					demo.button(),
				]}
			>
				1s
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
