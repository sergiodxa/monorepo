/**
 * An `mb` example with two values, so the block-start and block-end margins differ and
 * each can be told apart in the stripes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mb } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Different block-start and block-end margins. */
export default {
	title: "Start and end",
	description:
		"Pass two values to set the block-start and then the block-end margin, like `mb(2, 10)`:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[mb(2, 10), demo.block()]}>mb(2, 10)</div>
		</div>
	),
} satisfies UtilityExampleModule;
