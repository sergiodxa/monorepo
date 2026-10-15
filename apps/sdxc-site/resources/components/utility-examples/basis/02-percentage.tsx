/**
 * A `basis` example with percentages, which size items as a share of their flex
 * container instead of a fixed length.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { basis, flex, gap } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Flex items starting from a share of their container's width. */
export default {
	title: "Using a percentage",
	description: 'Pass a percentage like `basis("25%")` to size an item as a share of its container:',
	align: "stretch",
	render: () => (
		<div mix={[flex(), gap(4)]}>
			<div mix={[basis("25%"), demo.block()]}>25%</div>
			<div mix={[basis("25%"), demo.block()]}>25%</div>
			<div mix={[basis("50%"), demo.block()]}>basis("50%")</div>
		</div>
	),
} satisfies UtilityExampleModule;
