/**
 * The opening `container` example: the same card in two containers of different widths,
 * laid out stacked in the narrow one and side by side in the wide one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { container, gap, grid, gridTemplate } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is, m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One card laid out by the width of the named container it sits in. */
export default {
	title: "Basic example",
	description:
		"Use `container(name)` to make an element a container that its descendants query with `at(size, name, ...)`, so a component adapts to the room it is given rather than to the viewport:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[container("card"), is(60)]}>
				<article
					mix={[
						grid(),
						at("sm", "card", gridTemplate({ columns: "8rem 1fr" })),
						gap(3),
						demo.panel(),
					]}
				>
					<div mix={[bs(24), demo.photo()]} />
					<p mix={[m(0), text("sm")]}>A narrow container stacks the photo over the text.</p>
				</article>
			</div>
			<div mix={[container("card"), is(120)]}>
				<article
					mix={[
						grid(),
						at("sm", "card", gridTemplate({ columns: "8rem 1fr" })),
						gap(3),
						demo.panel(),
					]}
				>
					<div mix={[bs(24), demo.photo()]} />
					<p mix={[m(0), text("sm")]}>
						A container wider than 24rem sets the photo beside the text.
					</p>
				</article>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
