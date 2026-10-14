/**
 * The opening `outline` example: the default ring-colored outline, a toned one and a
 * wider one, each drawn outside the box without moving it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { outline } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The default outline, a toned outline and a wider one. */
export default {
	title: "Basic example",
	description:
		"Use `outline()` to draw an outline around an element; pass a tone to color it, or a number to set its width in pixels:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[outline(), demo.block()]}>outline()</div>
			<div mix={[outline("success"), demo.block()]}>outline("success")</div>
			<div mix={[outline(4), demo.block()]}>outline(4)</div>
		</div>
	),
} satisfies UtilityExampleModule;
