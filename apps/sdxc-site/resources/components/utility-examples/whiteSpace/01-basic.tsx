/**
 * The opening `whiteSpace` example: text with line breaks and runs of spaces in its
 * source, kept as written by the default value and collapsed by `"normal"`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";
import { whiteSpace } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A delivery note with its own line breaks, preserved and collapsed. */
export default {
	title: "Basic example",
	description:
		'Use `whiteSpace()` to keep the line breaks and spaces written in the text while still wrapping long lines; `whiteSpace("normal")` collapses them:',
	render: () => (
		<div mix={[maxIs(72), demo.stack()]}>
			<div mix={[demo.panel()]}>
				<p mix={[demo.caption()]}>whiteSpace()</p>
				<p mix={[whiteSpace()]}>
					{
						"Leave the parcel with the neighbour at number 14.\n\nIf nobody answers,    try the side gate."
					}
				</p>
			</div>
			<div mix={[demo.panel()]}>
				<p mix={[demo.caption()]}>whiteSpace("normal")</p>
				<p mix={[whiteSpace("normal")]}>
					{
						"Leave the parcel with the neighbour at number 14.\n\nIf nobody answers,    try the side gate."
					}
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
