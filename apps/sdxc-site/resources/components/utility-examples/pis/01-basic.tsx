/**
 * The opening `pis` example: a box padded on its inline-start edge only, with the
 * padding drawn as stripes before it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { pis } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Padding on the inline-start edge only. */
export default {
	title: "Basic example",
	description:
		"Use `pis(n)` to pad the inline-start edge of an element, its left in left-to-right text:",
	render: () => (
		<div mix={[pis(12), demo.stripes()]}>
			<div mix={[demo.block()]}>pis(12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
