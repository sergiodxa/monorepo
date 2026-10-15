/**
 * The opening `counterReset` example: a recipe whose list starts a counter its steps
 * count up and print, so the numbers can be styled like any other text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { counterIncrement, counterReset, listStyle, pseudoContent } from "sdxc/u/general";
import { before } from "sdxc/u/state";
import { weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Steps numbered by a CSS counter the list starts. */
export default {
	title: "Basic example",
	description:
		"Use `counterReset(name)` on a container to start a counter at zero, then count it up with `counterIncrement()` and print it with `counter(name)`:",
	render: () => (
		<ol mix={[counterReset("step"), listStyle(), demo.stack()]}>
			<li
				mix={[
					counterIncrement("step"),
					before([pseudoContent('"Step " counter(step) ". "'), weight("bold"), fg("brand")]),
				]}
			>
				Heat the oven to 200°C.
			</li>
			<li
				mix={[
					counterIncrement("step"),
					before([pseudoContent('"Step " counter(step) ". "'), weight("bold"), fg("brand")]),
				]}
			>
				Toss the squash in oil and salt.
			</li>
			<li
				mix={[
					counterIncrement("step"),
					before([pseudoContent('"Step " counter(step) ". "'), weight("bold"), fg("brand")]),
				]}
			>
				Roast for 35 minutes, turning once.
			</li>
		</ol>
	),
} satisfies UtilityExampleModule;
