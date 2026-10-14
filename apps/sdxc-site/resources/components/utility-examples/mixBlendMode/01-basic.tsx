/**
 * The opening `mixBlendMode` example: the same brand box blended into a photograph three
 * ways, so the reader sees each mode mix it with what is behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mixBlendMode } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One box blended into a photograph with three blend modes. */
export default {
	title: "Basic example",
	description:
		'Use `mixBlendMode(mode)` to blend an element with the content behind it, like `"multiply"`, `"screen"` or `"overlay"`:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.scene()]}>
				<div mix={[mixBlendMode("multiply"), demo.block()]}>multiply</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[mixBlendMode("screen"), demo.block()]}>screen</div>
			</div>
			<div mix={[demo.scene()]}>
				<div mix={[mixBlendMode("overlay"), demo.block()]}>overlay</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
