/**
 * The opening `counterIncrement` example: chapter headings that each count a counter up
 * by one and print it, so reordering the chapters renumbers them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { counterIncrement, counterReset, pseudoContent } from "@sdxc/u/general";
import { before } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Headings numbered by a counter each one steps. */
export default {
	title: "Basic example",
	description:
		"Use `counterIncrement(name)` on each element that should count, then print the counter with `counter(name)` in a pseudo-element:",
	render: () => (
		<section mix={[counterReset("chapter"), demo.stack()]}>
			<h3
				mix={[
					counterIncrement("chapter"),
					text("lg"),
					weight("semibold"),
					before([pseudoContent('"Chapter " counter(chapter) " · "'), fg("neutral.muted")]),
				]}
			>
				The lighthouse keeper
			</h3>
			<h3
				mix={[
					counterIncrement("chapter"),
					text("lg"),
					weight("semibold"),
					before([pseudoContent('"Chapter " counter(chapter) " · "'), fg("neutral.muted")]),
				]}
			>
				A storm in October
			</h3>
			<h3
				mix={[
					counterIncrement("chapter"),
					text("lg"),
					weight("semibold"),
					before([pseudoContent('"Chapter " counter(chapter) " · "'), fg("neutral.muted")]),
				]}
			>
				What the tide left
			</h3>
		</section>
	),
} satisfies UtilityExampleModule;
