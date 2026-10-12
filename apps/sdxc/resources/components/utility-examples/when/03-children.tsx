/**
 * A `when` example targeting children from the parent with `& > * + *`, spacing a stack
 * from one place, so the reader sees a selector reach past the element itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mbs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A gap above every child but the first, set once on the parent. */
export default {
	title: "Styling children",
	description:
		"Start the selector with `& >` to reach an element's children, like spacing every item after the first:",
	render: () => (
		<div mix={[when("& > * + *", mbs(4)), demo.stripes()]}>
			<div mix={[demo.block()]}>1</div>
			<div mix={[demo.block()]}>2</div>
			<div mix={[demo.block()]}>3</div>
		</div>
	),
} satisfies UtilityExampleModule;
