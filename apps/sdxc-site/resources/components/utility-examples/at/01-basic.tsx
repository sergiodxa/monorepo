/**
 * The opening `at` example: a card inside a container the reader can resize, which lays
 * its image beside its text once the container is at least the `sm` step wide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "sdxc/u/effects";
import { container, gap, grid, gridTemplate, resize } from "sdxc/u/layout";
import { overflow } from "sdxc/u/overflow";
import { at } from "sdxc/u/responsive";
import { bs, fit, is, minIs } from "sdxc/u/size";
import { weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A card that changes layout at a container width. */
export default {
	title: "Basic example",
	description:
		"Use `at(size, ...)` to apply utilities only when the nearest container is at least that wide, from the container scale (`xs`, `sm`, `md`…). The box is a container declared with `container()`. Drag the handle at the box's bottom-right corner to resize it and watch the layout change:",
	align: "stretch",
	render: () => (
		<div mix={[container("card"), resize("horizontal"), overflow(), minIs(48), demo.panel()]}>
			<article mix={[grid(), gap(4), at("sm", gridTemplate({ columns: "10rem 1fr" }))]}>
				<img src={demo.photoUrl()} alt="" mix={[is("100%"), bs(24), fit(), rounded("md")]} />
				<div>
					<h3 mix={[weight("semibold")]}>Lakeside cabin</h3>
					<p mix={[demo.caption()]}>Sleeps four, with a dock on the water.</p>
				</div>
			</article>
		</div>
	),
} satisfies UtilityExampleModule;
