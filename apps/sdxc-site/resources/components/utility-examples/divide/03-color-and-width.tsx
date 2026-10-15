/**
 * A `divide` example with a color and a width, and one with a width alone, so a reader
 * sees how the optional arguments are read in order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { divide } from "sdxc/u/overflow";
import { p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A tone and a width for the divider, or a width on its own. */
export default {
	title: "Color and width",
	description:
		'Pass a color token and a width in pixels, like `divide("block", "brand", 2)`, or a width alone, like `divide("block", 3)`:',
	render: () => (
		<div mix={[demo.row()]}>
			<ul mix={[divide("block", "brand", 2), demo.panel()]}>
				<li mix={[p(3)]}>One</li>
				<li mix={[p(3)]}>Two</li>
				<li mix={[p(3)]}>Three</li>
			</ul>
			<ul mix={[divide("block", 3), demo.panel()]}>
				<li mix={[p(3)]}>One</li>
				<li mix={[p(3)]}>Two</li>
				<li mix={[p(3)]}>Three</li>
			</ul>
		</div>
	),
} satisfies UtilityExampleModule;
