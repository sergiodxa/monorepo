/**
 * An `env` example with a fallback: a message composer lifted above the on-screen keyboard
 * where the browser reports its height, and resting at the bottom everywhere else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { env } from "sdxc/u/general";
import { is, mbe, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A composer offset by the keyboard's height, or by nothing where none is reported. */
export default {
	title: "Providing a fallback",
	description:
		'Pass a second argument for browsers that do not define the variable, like `env("keyboard-inset-height", "0px")`:',
	align: "stretch",
	render: () => (
		<div mix={[demo.panel()]}>
			<input
				placeholder="Write a message…"
				mix={[
					is("full"),
					p(2, 3),
					mbe(env("keyboard-inset-height", "0px")),
					rounded("md"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
				]}
			/>
		</div>
	),
} satisfies UtilityExampleModule;
