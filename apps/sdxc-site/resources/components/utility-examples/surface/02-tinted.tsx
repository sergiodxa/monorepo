/**
 * A `surface` example with the muted recipe and two tinted ones, the quiet surfaces a
 * callout or a notice sits on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, surface } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The muted surface and two tinted tones. */
export default {
	title: "Muted and tinted surfaces",
	description:
		"Use the `muted` recipe for a quiet panel, or a tone with `.tinted`, like `brand.tinted`, for a tinted callout:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[surface("muted"), border({ width: 1 }), demo.swatch()]}>surface("muted")</div>
			<div mix={[surface("brand.tinted"), border({ width: 1 }), demo.swatch()]}>
				surface("brand.tinted")
			</div>
			<div mix={[surface("danger.tinted"), border({ width: 1 }), demo.swatch()]}>
				surface("danger.tinted")
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
