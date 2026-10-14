/**
 * The opening `supports` example: a pane that is solid by default and turns into
 * frosted glass only in a browser that supports backdrop filters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "@sdxc/u/color";
import { backdropBlur } from "@sdxc/u/effects";
import { supports } from "@sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A frosted pane only where backdrop filters work. */
export default {
	title: "Basic example",
	description:
		'Use `supports(query, ...)` to apply utilities only when the browser supports a feature, like `supports("(backdrop-filter: blur(1px))", ...)`, keeping a solid fallback for the rest:',
	render: () => (
		<div mix={[demo.scene()]}>
			<div
				mix={[
					bg("color.neutral.900"),
					supports("(backdrop-filter: blur(1px))", [bg("transparent"), backdropBlur("md")]),
					demo.pane(),
				]}
			>
				Frosted glass
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
