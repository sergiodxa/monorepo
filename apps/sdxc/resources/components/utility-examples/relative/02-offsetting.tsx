/**
 * A `relative` example with offsets: the box shifts from its place in the flow while the
 * space it left behind, drawn as stripes, stays reserved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { insBs, insIs, relative } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Offsets move a relative element without moving anything around it. */
export default {
	title: "Offsetting in the flow",
	description:
		"Add offsets like `insBs(4)` and `insIs(6)` to shift a relative element from its place, while the space it came from stays reserved:",
	render: () => (
		<div mix={[demo.track()]}>
			<div mix={[relative(), insBs(4), insIs(6), demo.block()]}>relative()</div>
		</div>
	),
} satisfies UtilityExampleModule;
