/**
 * A `positionArea` example with `span-*` keywords: a menu that starts at its button's
 * leading edge and extends past it, the shape a dropdown takes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, anchorName, positionAnchor, positionArea } from "sdxc/u/layout";
import { bs, is, mbs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A span keyword covers the anchor's cell and the one beside it. */
export default {
	title: "Spanning cells",
	description:
		"Use a `span-*` keyword, like `\"bottom span-right\"`, to cover the anchor's cell and the one beside it, so a menu lines up with its button's edge:",
	render: () => (
		<div mix={[is(72), bs(32)]}>
			<button type="button" mix={[anchorName("account"), demo.button()]}>
				Account
			</button>
			<div
				mix={[
					absolute(),
					positionAnchor("account"),
					positionArea("bottom span-right"),
					mbs(2),
					is(48),
					demo.card(),
				]}
			>
				Signed in as Ada
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
