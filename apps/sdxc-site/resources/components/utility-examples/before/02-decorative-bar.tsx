/**
 * A `before` example drawing an empty, absolutely positioned bar beside a callout, so the
 * reader sees a pseudo-element used as pure decoration that needs no extra element.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { pseudoContent } from "sdxc/u/general";
import { absolute, inset, relative } from "sdxc/u/layout";
import { is, pis } from "sdxc/u/size";
import { before } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An empty `::before` stretched down the callout's start edge as an accent bar. */
export default {
	title: "Decorative shapes",
	description:
		"Pass `pseudoContent('\"\"')` for an empty pseudo-element, then position and paint it like any other box:",
	render: () => (
		<aside
			mix={[
				relative(),
				pis(6),
				before([
					pseudoContent('""'),
					absolute(),
					inset(0, "auto", 0, 0),
					is(1),
					rounded("full"),
					bg("brand.solid"),
				]),
				demo.prose(),
			]}
		>
			Upgrade to Bun 1.3 before running the migrations.
		</aside>
	),
} satisfies UtilityExampleModule;
