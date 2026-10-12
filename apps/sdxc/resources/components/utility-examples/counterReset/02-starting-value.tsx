/**
 * A `counterReset` example with a starting value: a list split by a note continues its
 * numbering on the far side instead of starting over at one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { counterIncrement, counterReset, listStyle, pseudoContent } from "@sdxc/u/general";
import { before } from "@sdxc/u/state";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A second list that picks up its numbering where the first one stopped. */
export default {
	title: "Setting a starting value",
	description:
		'Pass a second argument to start the counter somewhere else, like `counterReset("step", 2)` so the next step prints 3:',
	render: () => (
		<div mix={[demo.stack()]}>
			<ol mix={[counterReset("step"), listStyle()]}>
				<li
					mix={[
						counterIncrement("step"),
						before([pseudoContent('counter(step) ". "'), weight("bold"), fg("brand")]),
					]}
				>
					Unscrew the back panel.
				</li>
				<li
					mix={[
						counterIncrement("step"),
						before([pseudoContent('counter(step) ". "'), weight("bold"), fg("brand")]),
					]}
				>
					Disconnect the battery.
				</li>
			</ol>
			<p mix={[demo.panel()]}>Wait five minutes before touching the board.</p>
			<ol mix={[counterReset("step", 2), listStyle()]}>
				<li
					mix={[
						counterIncrement("step"),
						before([pseudoContent('counter(step) ". "'), weight("bold"), fg("brand")]),
					]}
				>
					Lift out the old fan.
				</li>
				<li
					mix={[
						counterIncrement("step"),
						before([pseudoContent('counter(step) ". "'), weight("bold"), fg("brand")]),
					]}
				>
					Seat the new one and reconnect.
				</li>
			</ol>
		</div>
	),
} satisfies UtilityExampleModule;
