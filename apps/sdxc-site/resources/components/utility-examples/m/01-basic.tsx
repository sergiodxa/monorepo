/**
 * The opening `m` example: one box with a margin on every side, drawn as stripes so the
 * space the call reserves around the box is what the reader sees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { m } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Margin on all four sides from one step of the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `m(n)` with a step of the spacing scale, like `m(4)` or `m(8)`, to add margin on every side of an element:",
	render: () => (
		<div mix={[demo.marginArea()]}>
			<div mix={[m(8), demo.block()]}>m(8)</div>
		</div>
	),
} satisfies UtilityExampleModule;
