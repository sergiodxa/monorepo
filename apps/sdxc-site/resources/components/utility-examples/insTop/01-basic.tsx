/**
 * The opening `insTop` example: two positioned boxes, one flush with the top edge of its
 * container and one a few steps of the spacing scale away from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insTop, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The offset from the top edge, flush and then from the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `insTop(n)` to set the `top` offset of a positioned element from the spacing scale:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insTop(0), demo.block()]}>insTop(0)</div>
			</div>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insTop(6), demo.block()]}>insTop(6)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
