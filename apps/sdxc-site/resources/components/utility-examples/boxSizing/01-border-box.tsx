/**
 * The opening `boxSizing` example: a 128px box with a border and padding that still
 * measures 128px, because `"border-box"` counts them inside the size it was given.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "@sdxc/u/color";
import { boxSizing } from "@sdxc/u/layout";
import { bs, is, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A box whose border and padding fit inside its declared size. */
export default {
	title: "Including borders and padding",
	description:
		'Use `boxSizing("border-box")` to make the size you set include the element\'s border and padding. This box is 128px wide:',
	render: () => (
		<div mix={[demo.figure()]}>
			<div
				mix={[
					boxSizing("border-box"),
					is(32),
					bs(32),
					p(4),
					border({ color: "brand.strong", width: 4, style: "solid" }),
					demo.stripes(),
				]}
			>
				<div mix={[bs("full"), demo.box()]} />
			</div>
			<span mix={[demo.caption()]}>boxSizing("border-box")</span>
		</div>
	),
} satisfies UtilityExampleModule;
