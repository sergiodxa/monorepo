/**
 * An `m` example with two values, which set the block margin and the inline margin
 * apart, so one call spaces an element vertically and horizontally.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { m } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Block then inline margin, from two steps of the spacing scale. */
export default {
	title: "Block and inline margin",
	description:
		"Pass two values to set the block margin and then the inline margin, like `m(4, 12)`:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[m(4, 12), demo.block()]}>m(4, 12)</div>
		</div>
	),
} satisfies UtilityExampleModule;
