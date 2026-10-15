/**
 * A `tracking` example with a value off the scale: the open letter spacing small capitals
 * want in an eyebrow label above a heading.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { text, textTransform, tracking, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** An uppercase eyebrow label spaced by a custom amount, over a tightly tracked heading. */
export default {
	title: "Custom values",
	description:
		'Pass any `letter-spacing` value, like `tracking("0.18em")`, for spacing the scale does not cover:',
	render: () => (
		<div>
			<p
				mix={[
					tracking("0.18em"),
					textTransform("uppercase"),
					text("xs"),
					weight("semibold"),
					fg("brand"),
				]}
			>
				New in 2026
			</p>
			<h3 mix={[tracking("tighter"), text("4xl"), weight("bold")]}>
				Faster builds, smaller bundles
			</h3>
		</div>
	),
} satisfies UtilityExampleModule;
