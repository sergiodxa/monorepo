/**
 * A `userSelect` example selecting everything at once: an install command that one click
 * highlights in full, ready to copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { userSelect } from "sdxc/u/general";
import { font } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A command selected whole by a single click. */
export default {
	title: "Selecting all at once",
	description:
		'Use `userSelect("all")` to select an element\'s whole text with one click. Click the command:',
	render: () => <code mix={[userSelect("all"), font("mono"), demo.panel()]}>bun add sdxc/u</code>,
} satisfies UtilityExampleModule;
