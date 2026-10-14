/**
 * The opening `insBottom` example: two positioned boxes, one flush with the bottom edge of its
 * container and one a few steps of the spacing scale away from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insBottom, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The offset from the bottom edge, flush and then from the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `insBottom(n)` to set the `bottom` offset of a positioned element from the spacing scale:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insBottom(0), demo.block()]}>insBottom(0)</div>
			</div>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insBottom(6), demo.block()]}>insBottom(6)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
