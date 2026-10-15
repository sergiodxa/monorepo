/**
 * The opening `translateProperty` example: tiles moved through the standalone `translate`
 * property on both axes at once, over striped ghosts of where they sat.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { translateProperty } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Movement on both axes through the standalone `translate` property. */
export default {
	title: "Basic example",
	description:
		"Use `translateProperty()` with a CSS `translate` value to move an element on both axes in one declaration:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[translateProperty("1rem 0.5rem"), demo.tile()]}>1rem 0.5rem</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[translateProperty("-25% 0"), demo.tile()]}>-25% 0</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
