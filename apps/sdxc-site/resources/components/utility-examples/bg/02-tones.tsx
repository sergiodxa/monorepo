/**
 * A `bg` example across the status tones, each at its tint and solid weight, so the
 * reader sees every tone shares the same two background weights.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Every status tone at its tint and solid weight. */
export default {
	title: "Tones",
	description:
		"Every tone, `brand`, `neutral`, `success`, `warning` and `danger`, has a `tint` weight for quiet surfaces and a `solid` weight for emphasis:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[bg("success.tint"), fg("success.emphasis"), demo.swatch()]}>
				bg("success.tint")
			</div>
			<div mix={[bg("success.solid"), fg("success.onSolid"), demo.swatch()]}>
				bg("success.solid")
			</div>
			<div mix={[bg("warning.tint"), fg("warning.emphasis"), demo.swatch()]}>
				bg("warning.tint")
			</div>
			<div mix={[bg("warning.solid"), fg("warning.onSolid"), demo.swatch()]}>
				bg("warning.solid")
			</div>
			<div mix={[bg("danger.tint"), fg("danger.emphasis"), demo.swatch()]}>bg("danger.tint")</div>
			<div mix={[bg("danger.solid"), fg("danger.onSolid"), demo.swatch()]}>bg("danger.solid")</div>
		</div>
	),
} satisfies UtilityExampleModule;
