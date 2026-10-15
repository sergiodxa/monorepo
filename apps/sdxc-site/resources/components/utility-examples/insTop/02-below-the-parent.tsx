/**
 * An `insTop` example with `"full"`, which places a menu right below the button it
 * belongs to, the offset every dropdown starts from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insLeft, insTop, relative } from "sdxc/u/layout";
import { bs, is, mbs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A top offset of the parent's full height opens a menu right under its trigger. */
export default {
	title: "Placing below the parent",
	description:
		'Use `insTop("full")` to place an element right below its positioned parent, like a menu under its button:',
	render: () => (
		<div mix={[bs(36)]}>
			<div mix={[relative()]}>
				<button type="button" mix={[demo.button()]}>
					Options
				</button>
				<div mix={[absolute(), insTop("full"), insLeft(0), mbs(2), is(40), demo.card()]}>Menu</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
