/**
 * An `mi` example with two values, so the inline-start and inline-end margins differ and
 * each can be told apart in the stripes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mi } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Different inline-start and inline-end margins. */
export default {
	title: "Start and end",
	description:
		"Pass two values to set the inline-start and then the inline-end margin, like `mi(2, 12)`:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[mi(2, 12), demo.block()]}>mi(2, 12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
