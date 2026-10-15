/**
 * A `listStyle` example with markers beyond bullets and numbers: roman numerals, a marker
 * drawn inside the item's box, and a string used as the marker itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { listStyle } from "sdxc/u/general";
import { gap, grid, gridTemplate } from "sdxc/u/layout";
import { pis } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Lists marked with roman numerals, inside squares and a check mark string. */
export default {
	title: "Other markers",
	description:
		"Pass any `list-style` value, like a counter style, a position or a quoted string to use as the marker:",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: "repeat(3, auto)" }), gap(10)]}>
			<div>
				<p mix={[demo.caption()]}>listStyle("lower-roman")</p>
				<ol mix={[listStyle("lower-roman"), pis(6)]}>
					<li>Preface</li>
					<li>Methods</li>
					<li>Results</li>
				</ol>
			</div>
			<div>
				<p mix={[demo.caption()]}>listStyle("square inside")</p>
				<ul mix={[listStyle("square inside"), demo.panel()]}>
					<li>Preface</li>
					<li>Methods</li>
					<li>Results</li>
				</ul>
			</div>
			<div>
				<p mix={[demo.caption()]}>listStyle('"✓ "')</p>
				<ul mix={[listStyle('"✓ "'), pis(5)]}>
					<li>Preface</li>
					<li>Methods</li>
					<li>Results</li>
				</ul>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
