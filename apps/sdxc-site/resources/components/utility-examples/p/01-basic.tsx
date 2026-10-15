/**
 * The opening `p` example: one box padded on every side, with the padding drawn as
 * stripes so the space the call reserves is what the reader sees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Padding on all four sides from one step of the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `p(n)` with a step of the spacing scale, like `p(4)` or `p(8)`, to pad every side of an element:",
	render: () => (
		<div mix={[p(8), demo.stripes()]}>
			<div mix={[demo.block()]}>p(8)</div>
		</div>
	),
} satisfies UtilityExampleModule;
