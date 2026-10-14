/**
 * The opening `is` example: boxes whose inline size climbs the spacing scale, stacked so
 * the steps line up against one another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Inline size from steps of the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `is(n)` with a step of the spacing scale, like `is(32)` or `is(64)`, to set an element's inline size, its width in horizontal text:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[is(96), demo.block()]}>is(96)</div>
			<div mix={[is(80), demo.block()]}>is(80)</div>
			<div mix={[is(64), demo.block()]}>is(64)</div>
			<div mix={[is(48), demo.block()]}>is(48)</div>
			<div mix={[is(40), demo.block()]}>is(40)</div>
			<div mix={[is(32), demo.block()]}>is(32)</div>
		</div>
	),
} satisfies UtilityExampleModule;
