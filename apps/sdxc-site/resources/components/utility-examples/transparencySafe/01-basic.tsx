/**
 * The opening `transparencySafe` example: a pane that blurs the photograph behind it
 * only when the reader has not asked their system for reduced transparency.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropBlur } from "sdxc/u/effects";
import { transparencySafe } from "sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A backdrop blur gated on the transparency preference. */
export default {
	title: "Basic example",
	description:
		"Use `transparencySafe(...)` to apply see-through effects only when the reader has not asked for less transparency. Turn on Reduce transparency in your system's accessibility settings to see the blur go:",
	render: () => (
		<div mix={[demo.scene()]}>
			<div mix={[transparencySafe(backdropBlur("lg")), demo.pane()]}>Frosted glass</div>
		</div>
	),
} satisfies UtilityExampleModule;
