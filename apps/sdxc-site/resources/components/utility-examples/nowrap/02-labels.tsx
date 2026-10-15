/**
 * A `nowrap` example where staying on one line is the point: a price and a date in a row
 * too narrow for them, which would otherwise break between their words.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { hstack } from "@sdxc/u/layout";
import { maxIs } from "@sdxc/u/size";
import { nowrap, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A price that stays whole while the description beside it wraps. */
export default {
	title: "Keeping a label whole",
	description:
		"Put `nowrap()` on a short label like a price or a date so the text beside it does the wrapping:",
	render: () => (
		<div mix={[hstack({ gap: 4, align: "start" }), maxIs(72), demo.panel()]}>
			<p>Hand-thrown stoneware mug, speckled glaze, 350 ml</p>
			<p mix={[nowrap(), weight("semibold"), fg("brand")]}>US$ 38.00</p>
		</div>
	),
} satisfies UtilityExampleModule;
