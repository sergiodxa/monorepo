/**
 * The opening `relative` example: a card made the containing block of an absolutely
 * positioned badge, so the badge's offsets measure from the card's corner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insBs, insIe, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A relative parent anchors the offsets of its absolutely positioned children. */
export default {
	title: "Basic example",
	description:
		"Use `relative()` to position an element in the normal flow, so its absolutely positioned children are offset from it:",
	render: () => (
		<div mix={[relative(), is(72), bs(36), demo.panel()]}>
			<p>Relative parent</p>
			<div mix={[absolute(), insBs(3), insIe(3), demo.block()]}>absolute()</div>
		</div>
	),
} satisfies UtilityExampleModule;
