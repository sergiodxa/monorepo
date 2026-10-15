/**
 * The opening `pie` example: a box padded on its inline-end edge only, with the padding
 * drawn as stripes after it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { pie } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Padding on the inline-end edge only. */
export default {
	title: "Basic example",
	description:
		"Use `pie(n)` to pad the inline-end edge of an element, its right in left-to-right text:",
	render: () => (
		<div mix={[pie(12), demo.stripes()]}>
			<div mix={[demo.block()]}>pie(12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
