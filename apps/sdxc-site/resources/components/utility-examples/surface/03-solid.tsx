/**
 * A `surface` example with the solid recipes, where a bare tone paints its solid
 * background with the text weight made to read on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, surface } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Solid surfaces in three tones. */
export default {
	title: "Solid surfaces",
	description:
		"Pass a bare tone, like `brand`, for a solid surface whose text color is chosen to read on it:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[surface("brand"), border({ width: 1 }), demo.swatch()]}>surface("brand")</div>
			<div mix={[surface("success"), border({ width: 1 }), demo.swatch()]}>surface("success")</div>
			<div mix={[surface("warning"), border({ width: 1 }), demo.swatch()]}>surface("warning")</div>
			<div mix={[surface("danger"), border({ width: 1 }), demo.swatch()]}>surface("danger")</div>
		</div>
	),
} satisfies UtilityExampleModule;
