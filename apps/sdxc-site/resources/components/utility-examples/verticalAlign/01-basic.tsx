/**
 * The opening `verticalAlign` example: a small inline box set in a tall line of text at
 * four alignments, so the reader sees where each one places it against the line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inlineBlock } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";
import { leading, verticalAlign } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An inline box aligned to the baseline, top, middle and bottom of a tall line. */
export default {
	title: "Basic example",
	description:
		'Use `verticalAlign(value)`, like `verticalAlign("middle")` or `verticalAlign("top")`, to place an inline element against the line it sits in:',
	render: () => (
		<div mix={[leading("4rem"), demo.stack()]}>
			<p mix={[demo.track()]}>
				<span mix={[verticalAlign("baseline"), inlineBlock(), is(4), bs(4), demo.box()]} />{" "}
				verticalAlign("baseline")
			</p>
			<p mix={[demo.track()]}>
				<span mix={[verticalAlign("top"), inlineBlock(), is(4), bs(4), demo.box()]} />{" "}
				verticalAlign("top")
			</p>
			<p mix={[demo.track()]}>
				<span mix={[verticalAlign("middle"), inlineBlock(), is(4), bs(4), demo.box()]} />{" "}
				verticalAlign("middle")
			</p>
			<p mix={[demo.track()]}>
				<span mix={[verticalAlign("bottom"), inlineBlock(), is(4), bs(4), demo.box()]} />{" "}
				verticalAlign("bottom")
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
