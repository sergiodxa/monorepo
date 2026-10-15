/**
 * The opening `userSelect` example: a paragraph that cannot be highlighted beside one that
 * can, so a reader drags across both to compare.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { userSelect } from "@sdxc/u/general";
import { maxIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A paragraph that resists selection next to one that allows it. */
export default {
	title: "Basic example",
	description:
		"Use `userSelect()` to keep text from being selected by an incidental click and drag. Try selecting both paragraphs:",
	render: () => (
		<div mix={[maxIs(96), demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>userSelect()</p>
				<p mix={[userSelect()]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>userSelect("auto")</p>
				<p mix={[userSelect("auto")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
