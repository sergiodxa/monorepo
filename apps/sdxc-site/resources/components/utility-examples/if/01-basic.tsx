/**
 * The opening `if` example: tabs drawn from one list, where only the current tab gets the
 * highlighted background, chosen by a condition inside the `mix` list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import * as u from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A tab bar highlighting the current tab through a conditional utility. */
export default {
	title: "Basic example",
	description:
		"Use `u.if(condition, utility)` to apply a utility, or a list of them, only when a condition holds; it is written `u.if` because `if` is a reserved word:",
	render: () => (
		<nav mix={[hstack({ gap: 1 })]}>
			{["Overview", "Activity", "Settings"].map((tab) => (
				<a
					href={`/${tab.toLowerCase()}`}
					mix={[
						p(2, 3),
						rounded("md"),
						weight("medium"),
						u.if(tab === "Activity", [bg("brand.solid"), fg("brand.onSolid")]),
					]}
				>
					{tab}
				</a>
			))}
		</nav>
	),
} satisfies UtilityExampleModule;
