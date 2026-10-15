/**
 * An `anchorSize` example on the block axis: an accent bar beside a card that is exactly
 * as tall as the card, however much text the card holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import {
	absolute,
	anchorName,
	anchorSize,
	positionAnchor,
	positionArea,
	relative,
} from "sdxc/u/layout";
import { bs, is, m, mis } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An accent bar sized to its card's block size with `anchorSize(name, "block")`. */
export default {
	title: "Matching the block size",
	description:
		'Measure the anchor\'s height with `anchorSize(name, "block")` to make a positioned element exactly as tall as it:',
	render: () => (
		<div mix={[relative(), is(80)]}>
			<p mix={[anchorName("quote-card"), is(64), m(0), demo.panel()]}>
				Anchor positioning keeps the accent bar exactly as tall as this card, however many lines it
				grows to.
			</p>
			<div
				mix={[
					absolute(),
					positionAnchor("quote-card"),
					positionArea("right"),
					bs(anchorSize("quote-card", "block")),
					is(1.5),
					mis(3),
					rounded("full"),
					bg("brand.solid"),
				]}
			/>
		</div>
	),
} satisfies UtilityExampleModule;
