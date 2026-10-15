/**
 * A `data` example with the two-argument form, matching a bare boolean `data-*` attribute,
 * so the reader sees a flag on the element switch a style on with no value to compare.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { opacity } from "sdxc/u/effects";
import { data } from "sdxc/u/state";
import { textDecoration } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Struck-through, faded text on the items flagged `data-done`. */
export default {
	title: "Matching a flag",
	description:
		"Leave out the value to match the attribute whenever it is present, like a bare `data-done` flag:",
	render: () => (
		<ul mix={[demo.prose()]}>
			<li data-done mix={[fg(), data("done", [textDecoration("line-through"), opacity(50)])]}>
				Write the README
			</li>
			<li mix={[fg(), data("done", [textDecoration("line-through"), opacity(50)])]}>
				Publish to npm
			</li>
			<li mix={[fg(), data("done", [textDecoration("line-through"), opacity(50)])]}>Announce it</li>
		</ul>
	),
} satisfies UtilityExampleModule;
