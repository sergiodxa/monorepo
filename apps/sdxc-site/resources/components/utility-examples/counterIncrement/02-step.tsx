/**
 * A `counterIncrement` example counting in steps of ten, the way old BASIC listings left
 * room between line numbers to insert new lines later.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { counterIncrement, counterReset, pseudoContent } from "sdxc/u/general";
import { before } from "sdxc/u/state";
import { font } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A program listing numbered 10, 20, 30 by a counter stepping by ten. */
export default {
	title: "Counting by a step",
	description:
		'Pass a second argument to step by more than one, like `counterIncrement("line", 10)`:',
	render: () => (
		<div mix={[counterReset("line"), font("mono"), demo.panel()]}>
			<p
				mix={[
					counterIncrement("line", 10),
					before([pseudoContent('counter(line) "  "'), fg("neutral.muted")]),
				]}
			>
				PRINT "WHAT IS YOUR NAME?"
			</p>
			<p
				mix={[
					counterIncrement("line", 10),
					before([pseudoContent('counter(line) "  "'), fg("neutral.muted")]),
				]}
			>
				INPUT N$
			</p>
			<p
				mix={[
					counterIncrement("line", 10),
					before([pseudoContent('counter(line) "  "'), fg("neutral.muted")]),
				]}
			>
				PRINT "HELLO, "; N$
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
