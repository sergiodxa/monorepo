/**
 * A `ringShadow` example stacked with an elevation shadow, so the reader sees the two
 * utilities share one composite box shadow and both layers render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ringShadow, shadow } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A ring and an elevation shadow on the same card. */
export default {
	title: "Combining with a shadow",
	description:
		"The ring and `shadow()` write separate layers of one `box-shadow`, so an element can have both:",
	render: () => <div mix={[ringShadow("brand"), shadow("xl"), demo.panel()]}>Selected plan</div>,
} satisfies UtilityExampleModule;
