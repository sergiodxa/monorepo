/**
 * A `pi` example with two values, so the inline-start and inline-end padding differ and
 * each can be told apart in the stripes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { pi } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Different inline-start and inline-end padding. */
export default {
	title: "Start and end",
	description:
		"Pass two values to pad the inline-start and then the inline-end edge, like `pi(2, 12)`:",
	render: () => (
		<div mix={[pi(2, 12), demo.stripes()]}>
			<div mix={[demo.block()]}>pi(2, 12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
