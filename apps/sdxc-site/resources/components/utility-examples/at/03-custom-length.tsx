/**
 * An `at` example with a literal length in place of a named step, for a breakpoint the
 * container scale does not hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "@sdxc/u/effects";
import { container, gap, grid, gridTemplate, resize } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { at } from "@sdxc/u/responsive";
import { bs, fit, is, minIs } from "@sdxc/u/size";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A container query at an arbitrary length. */
export default {
	title: "Using a custom length",
	description:
		'Pass any length, like `at("30rem", ...)`, for a breakpoint off the container scale. Drag the handle at the box\'s bottom-right corner to resize it and watch the layout change:',
	align: "stretch",
	render: () => (
		<div mix={[container("card"), resize("horizontal"), overflow(), minIs(48), demo.panel()]}>
			<article mix={[grid(), gap(4), at("30rem", gridTemplate({ columns: "1fr 2fr" }))]}>
				<img src={demo.photoUrl()} alt="" mix={[is("100%"), bs(24), fit(), rounded("md")]} />
				<div>
					<h3 mix={[weight("semibold")]}>Lakeside cabin</h3>
					<p mix={[demo.caption()]}>Sleeps four, with a dock on the water.</p>
				</div>
			</article>
		</div>
	),
} satisfies UtilityExampleModule;
