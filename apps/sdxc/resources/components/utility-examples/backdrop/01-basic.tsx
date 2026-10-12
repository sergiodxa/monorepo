/**
 * The opening `backdrop` example: a modal `<dialog>` opened with the Command Invoker API,
 * whose `::backdrop` dims the page behind it, so the reader opens it with no JavaScript.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { opacity } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { backdrop } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A dark, partly transparent layer painted behind the open modal. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `backdrop()` to paint the layer behind a modal dialog. Click the button to open the dialog:",
	render: () => (
		<div>
			<button
				type="button"
				commandfor="backdrop-basic"
				command="show-modal"
				mix={[bg("brand.solid"), fg("brand.onSolid"), cursor("pointer"), demo.control()]}
			>
				Delete project
			</button>
			<dialog id="backdrop-basic" mix={[backdrop([bg("neutral.solid"), opacity(60)]), demo.card()]}>
				<div mix={[vstack({ gap: 3 })]}>
					<p mix={[text("base"), weight("semibold")]}>Delete this project?</p>
					<button
						type="button"
						commandfor="backdrop-basic"
						command="close"
						mix={[bg("neutral.tint"), fg("neutral.emphasis"), cursor("pointer"), demo.control()]}
					>
						Cancel
					</button>
				</div>
			</dialog>
		</div>
	),
} satisfies UtilityExampleModule;
