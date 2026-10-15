/**
 * The opening `interpolateSize` example: a disclosure whose content animates open to its
 * natural height, a transition to `auto` that only runs with keyword interpolation on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition, transitionBehavior } from "sdxc/u/effects";
import { combine } from "sdxc/u/general";
import { interpolateSize } from "sdxc/u/layout";
import { overflow } from "sdxc/u/overflow";
import { bs, is, pbs } from "sdxc/u/size";
import { detailsContent, open } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Keyword interpolation lets the content's height animate from zero to auto. */
export default {
	title: "Basic example",
	description:
		"Use `interpolateSize()` to let an element animate to and from a keyword size like `auto`. Open the disclosure to see its content slide down:",
	render: () => (
		<details
			mix={[
				interpolateSize(),
				detailsContent(
					combine([
						bs(0),
						overflow("clip"),
						transition("block-size, content-visibility", { duration: 300 }),
						transitionBehavior("allow-discrete"),
					]),
				),
				open(detailsContent(bs("auto"))),
				is(80),
				demo.panel(),
			]}
		>
			<summary>What does interpolate-size do?</summary>
			<p mix={[pbs(2), demo.prose()]}>
				It lets sizes like auto and max-content take part in a transition, so this panel grows to
				its natural height instead of jumping to it.
			</p>
		</details>
	),
} satisfies UtilityExampleModule;
