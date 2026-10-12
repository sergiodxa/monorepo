/**
 * A `debug` example in nested mode, which outlines every descendant too, so a reader
 * sees the whole box model of a layout at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { debug } from "@sdxc/u/a11y";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A row whose every child is outlined too. */
export default {
	title: "Outlining descendants",
	description:
		"Pass `nested` to outline every descendant as well, to see how each box of a layout sits:",
	render: () => (
		<div mix={[debug("nested"), demo.row()]}>
			<div mix={[demo.block()]}>One</div>
			<div mix={[demo.block()]}>Two</div>
			<div mix={[demo.block()]}>Three</div>
		</div>
	),
} satisfies UtilityExampleModule;
