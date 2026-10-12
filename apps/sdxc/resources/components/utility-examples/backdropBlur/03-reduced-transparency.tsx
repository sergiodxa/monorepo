/**
 * A `backdropBlur` example gated on the reader's transparency preference, so a pane
 * blurs only for people who haven't asked their system to reduce transparency.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropBlur } from "@sdxc/u/effects";
import { transparencySafe } from "@sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A backdrop blur applied only without a reduced-transparency preference. */
export default {
	title: "Respecting reduced transparency",
	description:
		"Wrap it in `transparencySafe()` to blur the backdrop only for readers whose system allows transparency effects:",
	render: () => (
		<div mix={[demo.scene()]}>
			<div mix={[transparencySafe(backdropBlur("lg")), demo.pane()]}>transparencySafe(…)</div>
		</div>
	),
} satisfies UtilityExampleModule;
