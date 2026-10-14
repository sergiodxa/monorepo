/**
 * A `backdrop` example that blurs the page behind a modal instead of darkening it, so the
 * reader sees filter utilities apply to the top layer's backdrop too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { backdropBlur, backdropBrightness } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { backdrop } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A transparent backdrop that blurs and dims what it covers. */
export default {
	title: "Blurring the page",
	description:
		"Put `backdropBlur()` inside `backdrop()` to frost the page behind the dialog. Open it to see the blur:",
	render: () => (
		<div>
			<button
				type="button"
				commandfor="backdrop-blurred"
				command="show-modal"
				mix={[bg("brand.solid"), fg("brand.onSolid"), cursor("pointer"), demo.control()]}
			>
				Open settings
			</button>
			<dialog
				id="backdrop-blurred"
				mix={[
					backdrop([bg("transparent"), backdropBlur("md"), backdropBrightness(0.8)]),
					demo.card(),
				]}
			>
				<div mix={[vstack({ gap: 3 })]}>
					<p mix={[text("base"), weight("semibold")]}>Settings</p>
					<button
						type="button"
						commandfor="backdrop-blurred"
						command="close"
						mix={[bg("neutral.tint"), fg("neutral.emphasis"), cursor("pointer"), demo.control()]}
					>
						Done
					</button>
				</div>
			</dialog>
		</div>
	),
} satisfies UtilityExampleModule;
