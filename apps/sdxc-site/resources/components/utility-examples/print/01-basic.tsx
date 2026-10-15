/**
 * The opening `print` example: an invoice whose action buttons disappear on paper, so a
 * reader sees screen-only chrome removed from a printout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { hidden, hstack, vstack } from "sdxc/u/layout";
import { print } from "sdxc/u/responsive";
import { weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Interactive chrome hidden when printing. */
export default {
	title: "Basic example",
	description:
		"Use `print(...)` to apply utilities only when the page is printed, like hiding buttons that mean nothing on paper. Open your browser's print preview to see the buttons gone:",
	render: () => (
		<div mix={[vstack({ gap: 3 }), demo.panel()]}>
			<p mix={[weight("semibold")]}>Invoice #1042 — $240.00</p>
			<div mix={[hstack({ gap: 2 }), print(hidden())]}>
				<button type="button" mix={[bg("brand.solid"), fg("brand.onSolid"), demo.control()]}>
					Pay now
				</button>
				<button type="button" mix={[bg("neutral.tint"), fg("neutral.emphasis"), demo.control()]}>
					Download
				</button>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
