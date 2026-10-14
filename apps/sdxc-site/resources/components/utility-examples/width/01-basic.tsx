/**
 * The opening `width` example: boxes whose physical width climbs the spacing scale,
 * stacked so the steps line up against one another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { width } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Physical width from steps of the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `width(n)` with a step of the spacing scale, like `width(32)` or `width(64)`, to set an element's physical width:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[width(96), demo.block()]}>width(96)</div>
			<div mix={[width(80), demo.block()]}>width(80)</div>
			<div mix={[width(64), demo.block()]}>width(64)</div>
			<div mix={[width(48), demo.block()]}>width(48)</div>
			<div mix={[width(40), demo.block()]}>width(40)</div>
			<div mix={[width(32), demo.block()]}>width(32)</div>
		</div>
	),
} satisfies UtilityExampleModule;
