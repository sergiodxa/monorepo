/**
 * The opening `maxIs` example: boxes that would fill the row, each capped at a different
 * step, so the cap is the edge each one stops at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Inline-size caps from steps of the spacing scale. */
export default {
	title: "Basic example",
	description: "Use `maxIs(n)` to cap an element's inline size, like `maxIs(64)` or `maxIs(96)`:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[maxIs(128), demo.block()]}>maxIs(128)</div>
			<div mix={[maxIs(96), demo.block()]}>maxIs(96)</div>
			<div mix={[maxIs(64), demo.block()]}>maxIs(64)</div>
			<div mix={[maxIs(48), demo.block()]}>maxIs(48)</div>
		</div>
	),
} satisfies UtilityExampleModule;
