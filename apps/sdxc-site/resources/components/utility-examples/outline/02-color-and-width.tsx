/**
 * An `outline` example passing a tone and a width together, the two-argument form that
 * sets both in one call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { outline } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Outlines with a tone and a width each. */
export default {
	title: "Color and width",
	description: "Pass a tone and a width together, like `danger` and `4`, to set both at once:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[outline("danger", 4), demo.block()]}>outline("danger", 4)</div>
			<div mix={[outline("warning", 6), demo.block()]}>outline("warning", 6)</div>
		</div>
	),
} satisfies UtilityExampleModule;
