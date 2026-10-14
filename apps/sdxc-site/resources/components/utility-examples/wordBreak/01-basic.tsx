/**
 * The opening `wordBreak` example: a paragraph in a narrow card broken between any two
 * letters, so a long word ends the line flush instead of overflowing it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "@sdxc/u/size";
import { wordBreak } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A paragraph with a very long word, broken anywhere and left at its normal breaks. */
export default {
	title: "Basic example",
	description:
		'Use `wordBreak("break-all")` to let the browser break a line between any two letters, filling every line to the edge:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[maxIs(64), demo.panel()]}>
				<p mix={[demo.caption()]}>wordBreak("break-all")</p>
				<p mix={[wordBreak("break-all")]}>
					The longest word in a major English dictionary is
					pneumonoultramicroscopicsilicovolcanoconiosis.
				</p>
			</div>
			<div mix={[maxIs(64), demo.panel()]}>
				<p mix={[demo.caption()]}>wordBreak("normal")</p>
				<p mix={[wordBreak("normal")]}>
					The longest word in a major English dictionary is
					pneumonoultramicroscopicsilicovolcanoconiosis.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
