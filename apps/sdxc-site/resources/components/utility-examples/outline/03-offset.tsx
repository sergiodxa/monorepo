/**
 * An `outline` example with an offset, which opens a gap between the outline and the
 * element's border edge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { outline } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Outlines with no offset and with a gap. */
export default {
	title: "Offset",
	description: "Pass an object with `offset` to leave a gap between the outline and the element:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[outline({ color: "brand", offset: 0 }), demo.block()]}>offset: 0</div>
			<div mix={[outline({ color: "brand", offset: 4 }), demo.block()]}>offset: 4</div>
			<div mix={[outline({ color: "brand", offset: 8 }), demo.block()]}>offset: 8</div>
		</div>
	),
} satisfies UtilityExampleModule;
