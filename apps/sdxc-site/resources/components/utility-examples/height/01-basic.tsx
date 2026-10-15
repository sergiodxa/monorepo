/**
 * The opening `height` example: a row of boxes whose physical height climbs the spacing
 * scale, so each step's length is visible against its neighbours.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "sdxc/u/layout";
import { height, width } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Physical height from steps of the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `height(n)` with a step of the spacing scale, like `height(16)` or `height(32)`, to set an element's physical height:",
	render: () => (
		<div mix={[hstack({ gap: 4, align: "end" })]}>
			<div mix={[height(12), width(24), demo.cell()]}>height(12)</div>
			<div mix={[height(20), width(24), demo.cell()]}>height(20)</div>
			<div mix={[height(28), width(24), demo.cell()]}>height(28)</div>
			<div mix={[height(36), width(24), demo.cell()]}>height(36)</div>
			<div mix={[height(44), width(24), demo.cell()]}>height(44)</div>
		</div>
	),
} satisfies UtilityExampleModule;
