/**
 * An `anchor` example that lines a menu up with its button's end edge, so a menu wider
 * than its trigger grows toward the start instead of past the edge of the layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { listStyle } from "sdxc/u/general";
import {
	absolute,
	anchor,
	anchorName,
	flex,
	insBs,
	insIe,
	items,
	justify,
	relative,
} from "sdxc/u/layout";
import { bs, is, mbe, mbs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A menu aligned to the end edge of its trigger with `anchor(name, "end")`. */
export default {
	title: "Aligning to the end edge",
	description:
		'Use logical sides like `"start"` and `"end"` to line edges up in the writing direction, here keeping a wide menu flush with its button\'s end:',
	render: () => (
		<div mix={[relative(), flex(), items("start"), justify("end"), is(80), bs(44)]}>
			<button mix={[anchorName("account-menu"), demo.button()]}>Account</button>
			<ul
				mix={[
					absolute(),
					insBs(anchor("account-menu", "bottom")),
					insIe(anchor("account-menu", "end")),
					is(48),
					mbs(2),
					mbe(0),
					listStyle("none"),
					demo.panel(),
				]}
			>
				<li>Profile</li>
				<li>Billing</li>
				<li>Sign out</li>
			</ul>
		</div>
	),
} satisfies UtilityExampleModule;
