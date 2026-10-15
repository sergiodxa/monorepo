/**
 * The opening `insBs` example: two positioned boxes, one flush with the block-start edge of its
 * container and one a few steps of the spacing scale away from it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insBs, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The offset from the block-start edge, flush and then from the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `insBs(n)` to set the `inset-block-start` offset of a positioned element from the spacing scale, the top edge in horizontal text:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insBs(0), demo.block()]}>insBs(0)</div>
			</div>
			<div mix={[relative(), is(48), bs(32), demo.track()]}>
				<div mix={[absolute(), insBs(6), demo.block()]}>insBs(6)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
