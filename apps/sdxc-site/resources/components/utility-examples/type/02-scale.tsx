/**
 * A `type` example at three steps of the scale, for an interface whose titles, body and
 * fine print all share the sans family at different sizes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { type, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A title, a body line and fine print, each from one step of the scale. */
export default {
	title: "Choosing a step",
	description:
		'Pass any step of the text scale, from `type("xs")` for fine print to `type("4xl")` for a page title:',
	render: () => (
		<div mix={[demo.card()]}>
			<h3 mix={[type("xl"), weight("semibold")]}>Your order has shipped</h3>
			<p mix={[type("base")]}>It left our warehouse this morning and should arrive by Thursday.</p>
			<p mix={[type("xs"), fg("neutral.muted")]}>Order #10482 · Tracking updates every hour</p>
		</div>
	),
} satisfies UtilityExampleModule;
