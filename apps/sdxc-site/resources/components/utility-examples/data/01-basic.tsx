/**
 * The opening `data` example: a tab strip whose selected tab is named by a `data-state`
 * attribute, so the reader sees styles follow an app's own state attribute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { hstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { data } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A solid brand fill on whichever tab has `data-state="active"`. */
export default {
	title: "Basic example",
	description:
		"Pass an attribute and a value to `data()` to style an element by one of its `data-*` attributes:",
	render: () => (
		<div
			mix={[hstack({ gap: 1 }), p(1), rounded("lg"), border({ color: "neutral.border", width: 1 })]}
		>
			<span
				data-state="inactive"
				mix={[
					fg("neutral.muted"),
					data("state", "active", [bg("brand.solid"), fg("brand.onSolid")]),
					demo.control(),
				]}
			>
				Account
			</span>
			<span
				data-state="active"
				mix={[
					fg("neutral.muted"),
					data("state", "active", [bg("brand.solid"), fg("brand.onSolid")]),
					demo.control(),
				]}
			>
				Billing
			</span>
			<span
				data-state="inactive"
				mix={[
					fg("neutral.muted"),
					data("state", "active", [bg("brand.solid"), fg("brand.onSolid")]),
					demo.control(),
				]}
			>
				Team
			</span>
		</div>
	),
} satisfies UtilityExampleModule;
