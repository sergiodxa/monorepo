/**
 * An `atMax` example that names the container it queries, so the card stacks its parts
 * while a named ancestor is narrow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "sdxc/u/effects";
import { container, gap, grid, gridTemplate, resize } from "sdxc/u/layout";
import { overflow } from "sdxc/u/overflow";
import { atMax } from "sdxc/u/responsive";
import { bs, fit, is, minIs } from "sdxc/u/size";
import { weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A narrow-container rule against a named ancestor. */
export default {
	title: "Querying a named container",
	description:
		'Pass a container name, like `atMax("md", "panel", ...)`, to query that ancestor instead of the nearest container. Drag the handle at the box\'s bottom-right corner to resize it and watch the layout change:',
	align: "stretch",
	render: () => (
		<div mix={[container("panel"), resize("horizontal"), overflow(), minIs(48), demo.panel()]}>
			<article
				mix={[
					grid(),
					gap(4),
					gridTemplate({ columns: "10rem 1fr" }),
					atMax("md", "panel", gridTemplate({ columns: "1fr" })),
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
