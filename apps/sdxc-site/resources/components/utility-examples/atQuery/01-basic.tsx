/**
 * The opening `atQuery` example: a container condition written out in full, so a reader
 * sees the escape hatch take any `@container` query verbatim.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "sdxc/u/effects";
import { container, gap, grid, gridTemplate, resize } from "sdxc/u/layout";
import { overflow } from "sdxc/u/overflow";
import { atQuery } from "sdxc/u/responsive";
import { bs, fit, is, minIs } from "sdxc/u/size";
import { weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A container condition written verbatim. */
export default {
	title: "Basic example",
	description:
		'Use `atQuery(query, ...)` to write the whole `@container` condition yourself, like `atQuery("(min-width: 24rem)", ...)`. Drag the handle at the box\'s bottom-right corner to resize it and watch the layout change:',
	align: "stretch",
	render: () => (
		<div mix={[container("card"), resize("horizontal"), overflow(), minIs(48), demo.panel()]}>
			<article
				mix={[
					grid(),
					gap(4),
					atQuery("(min-width: 24rem)", gridTemplate({ columns: "10rem 1fr" })),
				]}
			>
				<img src={demo.photoUrl()} alt="" mix={[is("100%"), bs(24), fit(), rounded("md")]} />
				<div>
					<h3 mix={[weight("semibold")]}>Lakeside cabin</h3>
					<p mix={[demo.caption()]}>Sleeps four, with a dock on the water.</p>
				</div>
			</article>
		</div>
	),
} satisfies UtilityExampleModule;
