/**
 * A `scaleY` example on a disclosure's chevron, which flips while the `<details>` is
 * open, so a reader toggles it and sees the state drive the transform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "@sdxc/u/effects";
import { inlineBlock } from "@sdxc/u/layout";
import { open, when } from "@sdxc/u/state";
import { scaleY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A chevron flipped by the open state of its `<details>`. */
export default {
	title: "Flipping on open",
	description:
		"Combine it with a state like `open()` to flip an indicator while a disclosure is open. Click the summary to try it:",
	render: () => (
		<details mix={[open(when("& .chevron", scaleY(-1))), demo.panel()]}>
			<summary>
				Details{" "}
				<span class="chevron" mix={[inlineBlock(), transition("transform")]}>
					▾
				</span>
			</summary>
			<p>The chevron flips while this panel is open.</p>
		</details>
	),
} satisfies UtilityExampleModule;
