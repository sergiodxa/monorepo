/**
 * The opening `fg` example: the default text color beside a muted and a brand one, so a
 * reader sees the weights a tone names for text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The default text color, a muted one and a brand one. */
export default {
	title: "Basic example",
	description:
		"Use `fg` to set the text color of an element, from the page's default `fg()` to a tone and weight like `neutral.muted`:",
	render: () => (
		<div mix={[demo.stack()]}>
			<p mix={[fg(), demo.prose()]}>fg() reads the page's own text color.</p>
			<p mix={[fg("neutral.muted"), demo.prose()]}>fg("neutral.muted") is for secondary copy.</p>
			<p mix={[fg("brand"), demo.prose()]}>fg("brand") draws the eye to a link or an accent.</p>
		</div>
	),
} satisfies UtilityExampleModule;
