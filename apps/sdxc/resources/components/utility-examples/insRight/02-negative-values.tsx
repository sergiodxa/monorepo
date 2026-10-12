/**
 * An `insRight` example with a negative step, which hangs a notification badge over the
 * corner of the avatar it belongs to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { absolute, center, insRight, insTop, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A negative offset pushes an element past its parent's edge. */
export default {
	title: "Using negative values",
	description:
		"Pass a negative step, like `insRight(-2)`, to push an element past the edge of its parent, like a badge over an avatar:",
	render: () => (
		<div mix={[relative(), is(16), bs(16), demo.box()]}>
			<span
				mix={[
					absolute(),
					insTop(-2),
					insRight(-2),
					center(),
					is(6),
					bs(6),
					rounded("full"),
					bg("danger.solid"),
					fg("danger.onSolid"),
					text("xs"),
				]}
			>
				3
			</span>
		</div>
	),
} satisfies UtilityExampleModule;
