/**
 * A `grow` example with factors, so a reader sees an item with twice the factor take
 * twice the share of the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { basis, flex, gap, grow } from "sdxc/u/layout";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Items grow in proportion to the factor each one is given. */
export default {
	title: "Growing in proportion",
	description:
		"Pass a factor like `grow(2)` to grow items in proportion to each other, here from a `basis(0)` so the shares are exact:",
	align: "stretch",
	render: () => (
		<div mix={[flex(), gap(4), is("full")]}>
			<div mix={[grow(1), basis(0), demo.block()]}>grow(1)</div>
			<div mix={[grow(2), basis(0), demo.block()]}>grow(2)</div>
			<div mix={[grow(1), basis(0), demo.block()]}>grow(1)</div>
		</div>
	),
} satisfies UtilityExampleModule;
