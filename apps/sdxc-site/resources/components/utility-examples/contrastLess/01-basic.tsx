/**
 * The opening `contrastLess` example: a card whose strong border softens when the
 * reader asks their system for less contrast.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "@sdxc/u/color";
import { contrastLess } from "@sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A border softened for a less-contrast preference. */
export default {
	title: "Basic example",
	description:
		"Use `contrastLess(...)` to apply utilities when the reader asks for less contrast. Emulate `prefers-contrast: less` in your browser's dev tools to see the border soften:",
	render: () => (
		<div
			mix={[
				border({ color: "neutral.strong", width: 2 }),
				contrastLess(border("neutral")),
				demo.block(),
			]}
		>
			Strong border
		</div>
	),
} satisfies UtilityExampleModule;
