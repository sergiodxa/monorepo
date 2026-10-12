/**
 * A `roundedCorner` example shaping a chat bubble: three rounded corners and one left
 * square for the tail, the shape the utility exists for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { roundedCorner } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A message bubble with its tail corner left square. */
export default {
	title: "Shaping a chat bubble",
	description:
		"Round three corners and leave the fourth square to point a message bubble at its sender:",
	render: () => (
		<p
			mix={[
				roundedCorner("start-start", "xl"),
				roundedCorner("start-end", "xl"),
				roundedCorner("end-end", "xl"),
				demo.shape(),
			]}
		>
			See you at the station at six?
		</p>
	),
} satisfies UtilityExampleModule;
