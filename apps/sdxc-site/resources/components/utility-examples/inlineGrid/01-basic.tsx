/**
 * The `inlineGrid` example: a cluster of avatars laid out on a grid of three columns,
 * sitting inside a sentence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { gap, gridTemplate, inlineGrid, repeat } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A grid of avatars flows inline with the text around it. */
export default {
	title: "Basic example",
	description:
		"Use `inlineGrid()` to lay out an element's children on a grid while the element itself flows inline with the text:",
	render: () => (
		<div mix={[is(96), demo.prose()]}>
			Reviewed by{" "}
			<span mix={[inlineGrid(), gridTemplate({ columns: repeat(3, "1.25rem") }), gap(1)]}>
				<span mix={[is(5), bs(5), rounded("full"), bg("brand.solid")]} />
				<span mix={[is(5), bs(5), rounded("full"), bg("success.solid")]} />
				<span mix={[is(5), bs(5), rounded("full"), bg("warning.solid")]} />
			</span>{" "}
			and two others before it was merged.
		</div>
	),
} satisfies UtilityExampleModule;
