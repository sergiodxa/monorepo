/**
 * A `clip` example on a rounded card, so the image at its top follows the card's
 * corners rather than drawing square over them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { clip } from "@sdxc/u/overflow";
import { bs, fit, is, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A card whose rounded corners trim the image inside it. */
export default {
	title: "Clipping media to rounded corners",
	description: "Add `clip()` to a rounded card so the image at its edge follows its corners:",
	render: () => (
		<article mix={[clip(), rounded("xl"), is(64), border({ color: "neutral.border", width: 1 })]}>
			<img src={demo.photoUrl()} alt="" mix={[is("100%"), bs(32), fit()]} />
			<p mix={[p(4), demo.prose()]}>Mountain lake at noon</p>
		</article>
	),
} satisfies UtilityExampleModule;
