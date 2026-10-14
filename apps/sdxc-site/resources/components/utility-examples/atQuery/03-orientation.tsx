/**
 * An `atQuery` example on a size container, querying its orientation, so the card puts
 * its parts side by side once the box is wider than it is tall.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "@sdxc/u/effects";
import { container, gap, grid, gridTemplate, resize } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { atQuery } from "@sdxc/u/responsive";
import { bs, fit, is, minBs, minIs } from "@sdxc/u/size";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A query on the container's orientation. */
export default {
	title: "Querying orientation",
	description:
		'Declare a size container with `container(name, "size")` to query its height or orientation, like `atQuery("frame (orientation: landscape)", ...)`. Drag the handle at the box\'s bottom-right corner in any direction:',
	align: "stretch",
	render: () => (
		<div
			mix={[
				container("frame", "size"),
				resize("both"),
				overflow(),
				bs(64),
				minIs(48),
				minBs(32),
				demo.panel(),
			]}
		>
			<article
				mix={[
					grid(),
					gap(4),
					atQuery("frame (orientation: landscape)", gridTemplate({ columns: "1fr 1fr" })),
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
