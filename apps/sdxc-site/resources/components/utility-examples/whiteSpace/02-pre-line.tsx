/**
 * A `whiteSpace` example with `"pre-line"`, which keeps a poem's line breaks while folding
 * the indentation its source happens to carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { whiteSpace } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A stanza whose line breaks survive while its indentation collapses. */
export default {
	title: "Keeping only line breaks",
	description:
		'Use `whiteSpace("pre-line")` to keep line breaks but collapse runs of spaces into one:',
	render: () => (
		<p mix={[whiteSpace("pre-line"), demo.prose()]}>
			{
				"“Hope” is the thing with feathers -\n    That perches in the soul -\n    And sings the tune without the words -\n    And never stops - at all -"
			}
		</p>
	),
} satisfies UtilityExampleModule;
