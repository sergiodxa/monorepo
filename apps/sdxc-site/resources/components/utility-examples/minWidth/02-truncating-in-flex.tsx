/**
 * A `minWidth` example of the flex item that refuses to shrink below its content: a zero
 * minimum lets it shrink, so its text can truncate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "sdxc/u/layout";
import { circle, is, minWidth } from "sdxc/u/size";
import { truncate } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A zero minimum lets a flex item truncate. */
export default {
	title: "Truncating inside flex",
	description:
		"A flex item will not shrink below its content by default, so text truncated inside it overflows instead; use `minWidth(0)` on the item to let it shrink:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[hstack({ gap: 3 }), is(72), demo.panel()]}>
				<div mix={[circle(), is(10), shrink(), demo.fill()]}>PDF</div>
				<div>
					<p mix={[truncate(), demo.prose()]}>
						quarterly-report-final-version-with-every-appendix.pdf
					</p>
				</div>
			</div>
			<div mix={[hstack({ gap: 3 }), is(72), demo.panel()]}>
				<div mix={[circle(), is(10), shrink(), demo.fill()]}>PDF</div>
				<div mix={[minWidth(0)]}>
					<p mix={[truncate(), demo.prose()]}>
						quarterly-report-final-version-with-every-appendix.pdf
					</p>
				</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
