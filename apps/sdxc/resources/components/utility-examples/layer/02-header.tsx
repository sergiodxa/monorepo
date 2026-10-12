/**
 * A `layer` example ordering page regions, a sticky header above scrolling content, with
 * one number each, so the reader sees the call used the way an app shell uses it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, borderEdge } from "@sdxc/u/color";
import { sticky, insTop } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { maxBs, p } from "@sdxc/u/size";
import { layer } from "@sdxc/u/stacking";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The header's layer keeps it painted over the cards that scroll beneath it. */
export default {
	title: "Ordering page regions",
	description:
		"Give each region its own `layer()` so its order is one number, like a sticky header over raised cards. Scroll the box:",
	align: "stretch",
	render: () => (
		<div mix={[maxBs(48), overflow({ y: "auto" }), demo.frame()]}>
			<header
				mix={[
					sticky(),
					insTop(0),
					layer(10),
					p(3),
					bg(),
					borderEdge("block-end", { color: "neutral.border", width: 1 }),
					demo.caption(),
				]}
			>
				layer(10)
			</header>
			<div mix={[p(3), demo.stack()]}>
				<div mix={[layer(1), demo.card()]}>layer(1)</div>
				<div mix={[layer(1), demo.card()]}>layer(1)</div>
				<div mix={[layer(1), demo.card()]}>layer(1)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
