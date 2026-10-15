/**
 * The opening `insIs` example: two positioned boxes, one flush with the inline-start edge of its
 * container and one a few steps of the spacing scale away from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insIs, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The offset from the inline-start edge, flush and then from the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `insIs(n)` to set the `inset-inline-start` offset of a positioned element from the spacing scale, the left edge in left-to-right text:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insIs(0), demo.block()]}>insIs(0)</div>
			</div>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insIs(6), demo.block()]}>insIs(6)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
