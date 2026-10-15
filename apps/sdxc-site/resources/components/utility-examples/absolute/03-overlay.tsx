/**
 * An `absolute` example in a realistic place: a caption laid over a photograph, which is
 * how badges, captions and controls sit on top of media without taking up room of their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { absolute, insBottom, insLeft, relative } from "sdxc/u/layout";
import { bs, is, m, p } from "sdxc/u/size";
import { text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A caption laid over the corner of a photograph. */
export default {
	title: "Overlaying an image",
	description:
		"Absolutely positioned elements take no room in the flow, so they can sit on top of media like this caption over a photo:",
	render: () => (
		<figure mix={[relative(), is(96), bs(56), m(0), demo.photo()]}>
			<figcaption
				mix={[absolute(), insBottom(3), insLeft(3), p(1, 3), rounded("md"), bg(), fg(), text("sm")]}
			>
				Moraine Lake, Alberta
			</figcaption>
		</figure>
	),
} satisfies UtilityExampleModule;
