/**
 * The opening `center` example: one box in the middle of a larger striped area, centred on
 * both axes by a single call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { center } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A box centred both ways inside a larger area. */
export default {
	title: "Basic example",
	description:
		"Use `center()` to place an element's children in its middle, both horizontally and vertically:",
	render: () => (
		<div mix={[center(), is(72), bs(40), demo.track()]}>
			<div mix={[demo.block()]}>center()</div>
		</div>
	),
} satisfies UtilityExampleModule;
