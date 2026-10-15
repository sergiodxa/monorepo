/**
 * A `boxSizing` example with `"content-box"`, where the same size, border and padding
 * make a bigger box, because the size covers only the content inside them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "sdxc/u/color";
import { boxSizing } from "sdxc/u/layout";
import { bs, is, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A box whose border and padding are added outside its declared size. */
export default {
	title: "Excluding borders and padding",
	description:
		'Use `boxSizing("content-box")` to make the size you set cover only the content, adding border and padding on top. This box is 168px wide:',
	render: () => (
		<div mix={[demo.figure()]}>
			<div
				mix={[
					boxSizing("content-box"),
					is(32),
					bs(32),
					p(4),
					border({ color: "brand.strong", width: 4, style: "solid" }),
					demo.stripes(),
				]}
			>
				<div mix={[bs("full"), demo.box()]} />
			</div>
			<span mix={[demo.caption()]}>boxSizing("content-box")</span>
		</div>
	),
} satisfies UtilityExampleModule;
