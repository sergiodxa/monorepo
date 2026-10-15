/**
 * The opening `aria` example: toggle buttons styled from their `aria-pressed` value, so
 * the reader sees state read from the attribute assistive technology also announces.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { cursor } from "@sdxc/u/general";
import { aria } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A solid brand fill on whichever toggle has `aria-pressed="true"`. */
export default {
	title: "Basic example",
	description:
		"Pass an attribute and a value to `aria()` to style an element by its `aria-*` state, like a pressed toggle button:",
	render: () => (
		<div role="group" aria-label="Text style" mix={[demo.row()]}>
			<button
				type="button"
				aria-pressed="true"
				mix={[
					bg("transparent"),
					fg("neutral.muted"),
					aria("pressed", "true", [bg("brand.solid"), fg("brand.onSolid")]),
					cursor("pointer"),
					demo.control(),
				]}
			>
				Bold
			</button>
			<button
				type="button"
				aria-pressed="false"
				mix={[
					bg("transparent"),
					fg("neutral.muted"),
					aria("pressed", "true", [bg("brand.solid"), fg("brand.onSolid")]),
					cursor("pointer"),
					demo.control(),
				]}
			>
				Italic
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
