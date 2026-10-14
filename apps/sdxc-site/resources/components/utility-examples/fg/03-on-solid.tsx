/**
 * An `fg` example pairing each solid background with its `onSolid` text weight, the one
 * guaranteed to read on it in either color scheme.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Text on a solid background, at the tone's on-solid weight. */
export default {
	title: "Text on solid backgrounds",
	description:
		"Pair a `solid` background with the same tone's `onSolid` text weight, like `brand.onSolid`, so the text keeps its contrast:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[bg("brand.solid"), fg("brand.onSolid"), demo.swatch()]}>fg("brand.onSolid")</div>
			<div mix={[bg("neutral.solid"), fg("neutral.onSolid"), demo.swatch()]}>
				fg("neutral.onSolid")
			</div>
			<div mix={[bg("success.solid"), fg("success.onSolid"), demo.swatch()]}>
				fg("success.onSolid")
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
