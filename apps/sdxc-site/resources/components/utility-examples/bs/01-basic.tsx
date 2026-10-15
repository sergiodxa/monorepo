/**
 * The opening `bs` example: a row of boxes whose block size climbs the spacing scale, so
 * each step's length is visible against its neighbours.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Block size from steps of the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `bs(n)` with a step of the spacing scale, like `bs(16)` or `bs(32)`, to set an element's block size, its height in horizontal text:",
	render: () => (
		<div mix={[hstack({ gap: 4, align: "end" })]}>
			<div mix={[bs(12), is(20), demo.cell()]}>bs(12)</div>
			<div mix={[bs(20), is(20), demo.cell()]}>bs(20)</div>
			<div mix={[bs(28), is(20), demo.cell()]}>bs(28)</div>
			<div mix={[bs(36), is(20), demo.cell()]}>bs(36)</div>
			<div mix={[bs(44), is(20), demo.cell()]}>bs(44)</div>
		</div>
	),
} satisfies UtilityExampleModule;
