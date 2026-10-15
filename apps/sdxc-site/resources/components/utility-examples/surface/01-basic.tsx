/**
 * The opening `surface` example: a card on the default surface, whose background, text
 * and border colors come from one call as a matching set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, surface } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A card on the default surface. */
export default {
	title: "Basic example",
	description:
		"Use `surface()` to set the background, text and border colors of an element as one matching set:",
	render: () => (
		<div mix={[surface(), border({ width: 1 }), rounded("lg"), p(6)]}>
			<p mix={[demo.prose()]}>surface() paints the page's own background, text and border.</p>
		</div>
	),
} satisfies UtilityExampleModule;
