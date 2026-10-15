/**
 * A `colorScheme` example declaring both schemes, the default, under which the browser
 * follows the reader's own preference.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, colorScheme, fg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Controls that follow the reader's preferred scheme. */
export default {
	title: "Following the reader's preference",
	description:
		"Call `colorScheme()` with no argument to declare both schemes, so native controls follow the reader's system setting; set it once on `<html>`:",
	render: () => (
		<div mix={[colorScheme(), bg("Canvas"), fg("CanvasText"), rounded("lg"), p(4), demo.stack()]}>
			<input type="date" aria-label="Date" />
			<input type="checkbox" checked aria-label="Checkbox" />
		</div>
	),
} satisfies UtilityExampleModule;
