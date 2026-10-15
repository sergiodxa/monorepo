/**
 * The opening `before` example: a quote whose opening mark is generated in CSS, so the
 * reader sees content added ahead of an element's own text with no extra markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { pseudoContent } from "sdxc/u/general";
import { before } from "sdxc/u/state";
import { text, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A large brand quotation mark painted in the element's `::before`. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `before()` to style an element's `::before` pseudo-element, and give it something to show with `pseudoContent()`:",
	render: () => (
		<blockquote
			mix={[before([pseudoContent('"“"'), fg("brand"), text("3xl"), weight("bold")]), demo.prose()]}
		>
			Small, sharp tools that each do one thing well.
		</blockquote>
	),
} satisfies UtilityExampleModule;
