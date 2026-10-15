/**
 * A `bleed` example with no argument, which bleeds by the default step and so fits a
 * container padded by the same step, drawn as an accent rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "@sdxc/u/color";
import { bleed, bs, is, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The default bleed fits a `p(4)` container. */
export default {
	title: "Default amount",
	description:
		"Call `bleed()` with no argument to bleed by the default `4` step, which matches a container padded with `p(4)`:",
	render: () => (
		<div mix={[p(4), is(72), demo.frame()]}>
			<p mix={[demo.prose()]}>Order summary</p>
			<div mix={[bleed(), bs("2px"), bg("brand.solid")]} />
			<p mix={[demo.prose()]}>3 items</p>
		</div>
	),
} satisfies UtilityExampleModule;
