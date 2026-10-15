/**
 * The `inlineFlex` example: a mention chip, a status dot beside a name, laid out as a
 * flex row that still sits inside a sentence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { gap, inlineFlex, items } from "sdxc/u/layout";
import { bs, is, pi } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A chip lays out its own children in a row while flowing inline with the text. */
export default {
	title: "Basic example",
	description:
		"Use `inlineFlex()` to lay out an element's children as a flex row while the element itself flows inline with the text:",
	render: () => (
		<div mix={[is(96), demo.prose()]}>
			Ask{" "}
			<span
				mix={[
					inlineFlex(),
					items("center"),
					gap(1.5),
					pi(2),
					rounded("full"),
					bg("brand.tint"),
					fg("brand.emphasis"),
				]}
			>
				<span mix={[is(2), bs(2), rounded("full"), bg("success.solid")]} />
				Ada Lovelace
			</span>{" "}
			to review the change before it ships.
		</div>
	),
} satisfies UtilityExampleModule;
