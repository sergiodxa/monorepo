/**
 * A `translucent` example at each named blur, so a reader sees how strongly each step
 * softens the photograph behind the panel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { translucent } from "@sdxc/u/color";
import { p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Panels with the small, medium and large blur. */
export default {
	title: "Blur sizes",
	description: "Pass a blur name, `sm`, `md` or `lg`, to set how strongly the backdrop is blurred:",
	render: () => (
		<div mix={[p(8), demo.photo(), demo.row()]}>
			<div mix={[translucent("sm"), demo.swatch()]}>sm</div>
			<div mix={[translucent("md"), demo.swatch()]}>md</div>
			<div mix={[translucent("lg"), demo.swatch()]}>lg</div>
		</div>
	),
} satisfies UtilityExampleModule;
