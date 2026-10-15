/**
 * The opening `insRight` example: two positioned boxes, one flush with the right edge of its
 * container and one a few steps of the spacing scale away from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insRight, relative } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The offset from the right edge, flush and then from the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `insRight(n)` to set the `right` offset of a positioned element from the spacing scale:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insRight(0), demo.block()]}>insRight(0)</div>
			</div>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insRight(6), demo.block()]}>insRight(6)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
