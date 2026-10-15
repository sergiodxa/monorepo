/**
 * The opening `tabularNums` example: two columns of prices, one with proportional digits
 * and one with tabular digits, so the reader sees the second line up digit for digit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate } from "sdxc/u/layout";
import { tabularNums, textAlign } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A column of amounts with tabular digits beside the same column with proportional ones. */
export default {
	title: "Basic example",
	description:
		"Use `tabularNums()` to draw every digit at the same width, so columns of numbers line up and a changing total keeps still:",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: "auto auto" }), gap(12)]}>
			<div mix={[textAlign("end")]}>
				<p mix={[demo.caption()]}>tabularNums()</p>
				<p mix={[tabularNums()]}>$1,111.11</p>
				<p mix={[tabularNums()]}>$888.88</p>
				<p mix={[tabularNums()]}>$10,407.19</p>
			</div>
			<div mix={[textAlign("end")]}>
				<p mix={[demo.caption()]}>default digits</p>
				<p>$1,111.11</p>
				<p>$888.88</p>
				<p>$10,407.19</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
