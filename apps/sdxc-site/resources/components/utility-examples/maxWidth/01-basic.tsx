/**
 * The opening `maxWidth` example: boxes that would fill the row, each capped at a
 * different step, so the cap is the edge each one stops at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxWidth } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Width caps from steps of the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `maxWidth(n)` to cap an element's physical width, like `maxWidth(64)` or `maxWidth(96)`:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[maxWidth(128), demo.block()]}>maxWidth(128)</div>
			<div mix={[maxWidth(96), demo.block()]}>maxWidth(96)</div>
			<div mix={[maxWidth(64), demo.block()]}>maxWidth(64)</div>
			<div mix={[maxWidth(48), demo.block()]}>maxWidth(48)</div>
		</div>
	),
} satisfies UtilityExampleModule;
