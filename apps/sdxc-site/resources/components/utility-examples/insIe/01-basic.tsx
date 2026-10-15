/**
 * The opening `insIe` example: two positioned boxes, one flush with the inline-end edge of its
 * container and one a few steps of the spacing scale away from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insIe, relative } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The offset from the inline-end edge, flush and then from the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `insIe(n)` to set the `inset-inline-end` offset of a positioned element from the spacing scale, the right edge in left-to-right text:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insIe(0), demo.block()]}>insIe(0)</div>
			</div>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insIe(6), demo.block()]}>insIe(6)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
