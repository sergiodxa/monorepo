/**
 * A `flexRow` example that switches direction with the room it has: the same items stack
 * in a narrow container and line up once the container is wide enough.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { container, flex, flexCol, flexRow, gap } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Items that stack in a narrow container and form a row in a wide one. */
export default {
	title: "Switching direction by size",
	description:
		"Start with `flexCol()` and wrap `flexRow()` in a container query with `at()` to lay items out in a row only once there is room:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[container("toolbar"), is(56)]}>
				<div mix={[flex(), flexCol(), at("sm", "toolbar", flexRow()), gap(4)]}>
					<div mix={[demo.block()]}>01</div>
					<div mix={[demo.block()]}>02</div>
					<div mix={[demo.block()]}>03</div>
				</div>
			</div>
			<div mix={[container("toolbar"), is(120)]}>
				<div mix={[flex(), flexCol(), at("sm", "toolbar", flexRow()), gap(4)]}>
					<div mix={[demo.block()]}>01</div>
					<div mix={[demo.block()]}>02</div>
					<div mix={[demo.block()]}>03</div>
				</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
