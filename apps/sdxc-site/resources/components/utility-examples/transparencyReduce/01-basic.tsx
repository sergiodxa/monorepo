/**
 * The opening `transparencyReduce` example: a frosted pane given a solid background
 * when the reader asks their system for reduced transparency.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "sdxc/u/color";
import { backdropBlur } from "sdxc/u/effects";
import { transparencyReduce } from "sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A solid fallback for a reduced-transparency preference. */
export default {
	title: "Basic example",
	description:
		"Use `transparencyReduce(...)` to apply utilities when the reader asks for less transparency, like a solid background behind a frosted pane. Turn on Reduce transparency in your system's accessibility settings to see the pane turn solid:",
	render: () => (
		<div mix={[demo.scene()]}>
			<div mix={[backdropBlur("lg"), transparencyReduce(bg("color.neutral.900")), demo.pane()]}>
				Frosted glass
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
