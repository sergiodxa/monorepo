/**
 * The opening `overflowWrap` example: a long URL in a narrow card, broken onto the next
 * line where it would otherwise run past the card's edge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";
import { overflowWrap } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A long link wrapped inside its card, next to the same link left to overflow. */
export default {
	title: "Basic example",
	description:
		"Use `overflowWrap()` to break a word too long for its line, like a URL or a hash, while the rest of the text wraps at spaces as usual:",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[maxIs(64), demo.panel()]}>
				<p mix={[demo.caption()]}>overflowWrap()</p>
				<p mix={[overflowWrap()]}>
					Read the full report at https://example.com/reports/2026/annual-sustainability-review
				</p>
			</div>
			<div mix={[maxIs(64), demo.panel()]}>
				<p mix={[demo.caption()]}>default wrapping</p>
				<p>Read the full report at https://example.com/reports/2026/annual-sustainability-review</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
