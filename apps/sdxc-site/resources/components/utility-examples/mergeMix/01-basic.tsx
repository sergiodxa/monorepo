/**
 * The opening `mergeMix` example: a caption's own muted, small styles, then the same
 * styles merged with a caller's smaller size and brand color, which win over the
 * caption's own for the properties both set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { mergeMix } from "@sdxc/u/general";
import { text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The caption as designed, then with the caller's overrides merged on top. */
export default {
	title: "Basic example",
	description:
		"Use `mergeMix(ownMixins, mix)` where a component forwards its caller's `mix`, so a utility the caller passes wins over the component's own for the same property:",
	render: () => (
		<div mix={[demo.stack()]}>
			<span mix={[fg("neutral.muted"), text("sm")]}>Updated two minutes ago</span>
			<span mix={mergeMix([fg("neutral.muted"), text("sm")], [text("xs"), fg("brand")])}>
				Updated two minutes ago
			</span>
		</div>
	),
} satisfies UtilityExampleModule;
