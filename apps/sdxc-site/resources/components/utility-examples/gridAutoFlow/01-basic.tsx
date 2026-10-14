/**
 * The opening `gridAutoFlow` example: a three-row grid filled column by column, so the
 * numbers run down each column before moving to the next.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridAutoFlow, gridTemplate, repeat } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Grid items placed column by column. */
export default {
	title: "Basic example",
	description:
		'Use `gridAutoFlow("column")` to fill a grid column by column, creating new columns as items need them:',
	render: () => (
		<div mix={[grid(), gridTemplate({ rows: repeat(3, 1) }), gridAutoFlow("column"), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
			<div mix={[demo.block()]}>04</div>
			<div mix={[demo.block()]}>05</div>
			<div mix={[demo.block()]}>06</div>
			<div mix={[demo.block()]}>07</div>
		</div>
	),
} satisfies UtilityExampleModule;
