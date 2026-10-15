/**
 * A `text` example with paragraphs long enough to wrap, so the reader sees each step bring
 * a line height that suits it: roomy for small copy, tighter as the size grows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate } from "sdxc/u/layout";
import { text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Two wrapped paragraphs at different steps, each with the leading its step pairs. */
export default {
	title: "Paired line height",
	description:
		'Every step brings the line height that suits it, so wrapped text stays readable from `text("sm")` up to `text("2xl")`:',
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: "1fr 1fr" }), gap(8)]}>
			<div>
				<p mix={[demo.caption()]}>text("sm")</p>
				<p mix={[text("sm")]}>
					The kettle clicked off just as the rain started, and for a minute the whole kitchen
					smelled of wet pavement and black tea.
				</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>text("2xl")</p>
				<p mix={[text("2xl")]}>
					The kettle clicked off just as the rain started, and for a minute the whole kitchen
					smelled of wet pavement and black tea.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
