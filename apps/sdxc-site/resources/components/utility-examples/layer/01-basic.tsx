/**
 * The opening `layer` example: two overlapping cards, the first holding a badge with a
 * huge `z()`, so the reader sees the second card stay on top because layers isolate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { absolute, insBottom, insIe, relative } from "sdxc/u/layout";
import { is, mbs, mis, p } from "sdxc/u/size";
import { layer, z } from "sdxc/u/stacking";
import { text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The badge's `z(999)` counts only inside its own card, which sits below the second. */
export default {
	title: "Basic example",
	description:
		"Use `layer(n)` to start a stacking context and set its order in one call. A `z()` inside never climbs out of its layer:",
	render: () => (
		<div mix={[relative(), is(72)]}>
			<div mix={[relative(), layer(1), demo.card()]}>
				<span
					mix={[
						absolute(),
						insBottom(-3),
						insIe(4),
						z(999),
						p(1, 2),
						rounded("full"),
						text("xs"),
						bg("danger.solid"),
						fg("danger.onSolid"),
					]}
				>
					z(999)
				</span>
				<p mix={[demo.caption()]}>layer(1)</p>
			</div>
			<div mix={[relative(), layer(2), is(48), mbs(-6), mis(12), demo.card()]}>
				<p mix={[demo.caption()]}>layer(2) still covers the badge</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
