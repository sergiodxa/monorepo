/**
 * The opening `transitionProperty` example: three buttons whose hover grows them and
 * raises a shadow, each animating a different property list, so the reader sees what the
 * list leaves instant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { shadow, transitionDuration, transitionProperty } from "@sdxc/u/effects";
import { hover } from "@sdxc/u/state";
import { scale } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The same hover change with three different animated properties. */
export default {
	title: "Basic example",
	description:
		"Use `transitionProperty(list)` to choose which properties animate; the rest change instantly. Hover each button:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<button
				type="button"
				mix={[
					transitionProperty("transform"),
					transitionDuration("500ms"),
					hover([scale(1.2), shadow("xl")]),
					demo.button(),
				]}
			>
				transform
			</button>
			<button
				type="button"
				mix={[
					transitionProperty("box-shadow"),
					transitionDuration("500ms"),
					hover([scale(1.2), shadow("xl")]),
					demo.button(),
				]}
			>
				box-shadow
			</button>
			<button
				type="button"
				mix={[
					transitionProperty("all"),
					transitionDuration("500ms"),
					hover([scale(1.2), shadow("xl")]),
					demo.button(),
				]}
			>
				all
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
