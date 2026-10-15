/**
 * The opening `env` example: a tab bar padded by a fixed amount plus the device's bottom
 * safe area, so its labels clear a phone's home indicator.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "sdxc/u/color";
import { calc, env } from "sdxc/u/general";
import { hstack } from "sdxc/u/layout";
import { is, pbe, pbs } from "sdxc/u/size";
import { text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A bottom navigation bar whose padding grows with the safe area inset. */
export default {
	title: "Basic example",
	description:
		"Use `env(name)` to read a value the browser provides, like the safe area at the bottom of a phone screen, in any utility that takes a CSS value:",
	align: "stretch",
	render: () => (
		<nav
			mix={[
				hstack({ justify: "around" }),
				is("full"),
				pbs(3),
				pbe(calc(`0.75rem + ${env("safe-area-inset-bottom")}`)),
				bg(),
				fg("neutral.muted"),
				text("sm"),
				border({ color: "neutral.border", width: 1, style: "solid" }),
			]}
		>
			<a href="/home">Home</a>
			<a href="/search">Search</a>
			<a href="/library">Library</a>
			<a href="/profile">Profile</a>
		</nav>
	),
} satisfies UtilityExampleModule;
