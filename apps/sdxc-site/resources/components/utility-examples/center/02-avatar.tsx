/**
 * A `center` example in a familiar place: initials in the middle of a round avatar, the
 * shape `center()` handles more often than any other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { center } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Initials centred inside round avatars. */
export default {
	title: "Centring initials in an avatar",
	description:
		"Combine `center()` with a fixed size and a full radius to centre initials in an avatar:",
	render: () => (
		<div mix={[demo.row()]}>
			<span
				mix={[
					center(),
					is(10),
					bs(10),
					rounded("full"),
					bg("brand.solid"),
					fg("brand.onSolid"),
					text("sm"),
					weight("semibold"),
				]}
			>
				SX
			</span>
			<span
				mix={[
					center(),
					is(14),
					bs(14),
					rounded("full"),
					bg("brand.solid"),
					fg("brand.onSolid"),
					text("lg"),
					weight("semibold"),
				]}
			>
				SX
			</span>
			<span
				mix={[
					center(),
					is(20),
					bs(20),
					rounded("full"),
					bg("brand.solid"),
					fg("brand.onSolid"),
					text("2xl"),
					weight("semibold"),
				]}
			>
				SX
			</span>
		</div>
	),
} satisfies UtilityExampleModule;
