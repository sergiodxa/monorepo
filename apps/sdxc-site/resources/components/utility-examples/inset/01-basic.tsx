/**
 * The opening `inset` example: a positioned box held the same distance from every edge
 * of its container by one call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, inset, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One value offsets a positioned element from all four sides at once. */
export default {
	title: "Basic example",
	description:
		"Use `inset(n)` to offset a positioned element from every side of its container at once:",
	render: () => (
		<div mix={[relative(), is(64), bs(36), demo.track()]}>
			<div mix={[absolute(), inset(4), demo.block()]}>inset(4)</div>
		</div>
	),
} satisfies UtilityExampleModule;
