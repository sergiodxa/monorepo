/**
 * A `spacer` example in a column: a card's body stays at the top while the spacer pushes
 * its action to the bottom, however short the copy is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { spacer, vstack } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";
import { weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** In a column the spacer fills the leftover height. */
export default {
	title: "In a column",
	description:
		"In a column, `spacer()` fills the leftover height, holding a card's action to its bottom edge:",
	render: () => (
		<div mix={[vstack({ gap: 2, align: "start" }), is(64), bs(48), demo.panel()]}>
			<span mix={[weight("semibold")]}>Pro plan</span>
			<span mix={[demo.caption()]}>Everything in Free, plus SSO.</span>
			<div mix={[spacer()]} />
			<button type="button" mix={[demo.button()]}>
				Upgrade
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
