/**
 * A `vars` example overriding theme tokens for one section: the same brand button drawn
 * twice, the second under a parent that points the brand tokens at the success tone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import * as u from "@sdxc/u/general";
import { p } from "@sdxc/u/size";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A brand button restyled by overriding the brand tokens on a parent. */
export default {
	title: "Re-theming a section",
	description:
		"Theme tokens are custom properties too, so `vars()` can point them elsewhere for everything inside an element:",
	render: () => (
		<div mix={[demo.row()]}>
			<div>
				<button
					mix={[p(2, 4), rounded("md"), weight("medium"), bg("brand.solid"), fg("brand.onSolid")]}
				>
					Continue
				</button>
			</div>
			<div
				mix={[
					u.vars({
						"ui-brand-bg-solid": u.var("ui-success-bg-solid"),
						"ui-brand-fg-on-solid": u.var("ui-success-fg-on-solid"),
					}),
				]}
			>
				<button
					mix={[p(2, 4), rounded("md"), weight("medium"), bg("brand.solid"), fg("brand.onSolid")]}
				>
					Continue
				</button>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
