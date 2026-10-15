/**
 * The opening `insBe` example: two positioned boxes, one flush with the block-end edge of its
 * container and one a few steps of the spacing scale away from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insBe, relative } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The offset from the block-end edge, flush and then from the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `insBe(n)` to set the `inset-block-end` offset of a positioned element from the spacing scale, the bottom edge in horizontal text:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insBe(0), demo.block()]}>insBe(0)</div>
			</div>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insBe(6), demo.block()]}>insBe(6)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
