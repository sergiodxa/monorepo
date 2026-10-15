/**
 * The opening `bg` example: the brand tone at its two background weights beside the
 * neutral tint, so a reader sees that a tone names its weight at the call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A tone's tint and solid weights, and the neutral tint. */
export default {
	title: "Basic example",
	description:
		"Use `bg` with a tone and its weight, like `brand.tint` or `brand.solid`, to set the background color of an element:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[bg("brand.tint"), fg("brand.emphasis"), demo.swatch()]}>bg("brand.tint")</div>
			<div mix={[bg("brand.solid"), fg("brand.onSolid"), demo.swatch()]}>bg("brand.solid")</div>
			<div mix={[bg("neutral.tint"), fg("neutral.emphasis"), demo.swatch()]}>
				bg("neutral.tint")
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
