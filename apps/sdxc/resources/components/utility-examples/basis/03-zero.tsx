/**
 * A `basis` example comparing the default `auto` basis with `0%` under the same grow
 * factor: one row shares out space after content, the other shares all of it equally.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { basis, flex, gap, grow } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Growing items starting from their content size versus starting from zero. */
export default {
	title: "Starting from zero",
	description:
		'With `basis()` items grow from their content size; with `basis("0%")` they grow from nothing, so `grow()` splits the row into equal parts:',
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[flex(), gap(4)]}>
				<div mix={[grow(), basis(), demo.block()]}>basis()</div>
				<div mix={[grow(), basis(), demo.block()]}>a long label</div>
				<div mix={[grow(), basis(), demo.block()]}>short</div>
			</div>
			<div mix={[flex(), gap(4)]}>
				<div mix={[grow(), basis("0%"), demo.block()]}>basis("0%")</div>
				<div mix={[grow(), basis("0%"), demo.block()]}>a long label</div>
				<div mix={[grow(), basis("0%"), demo.block()]}>short</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
