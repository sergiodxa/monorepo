/**
 * A `content` example with `"between"`, the alias for `space-between`, so the free space of
 * a tall grid sits only between its rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { content, gap, grid, gridTemplate, repeat } from "sdxc/u/layout";
import { bs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Rows spread to both edges with the free space between them. */
export default {
	title: "Space between",
	description:
		'Use `content("between")` to push the first and last rows to the edges and share the free space between the rows:',
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({ columns: repeat(3, 1) }),
				content("between"),
				gap(4),
				bs(64),
				demo.track(),
			]}
		>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
		</div>
	),
} satisfies UtilityExampleModule;
