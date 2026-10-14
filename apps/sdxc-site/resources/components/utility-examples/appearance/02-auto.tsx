/**
 * An `appearance` example with both values side by side, so a reader sees what
 * `"auto"` brings back to a control a reset stripped of its platform look.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { appearance } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Two buttons, one stripped of its native look and one with it restored. */
export default {
	title: "Restoring native styling",
	description:
		'Use `appearance("auto")` to give a control back the platform\'s own look after `appearance("none")` cleared it:',
	render: () => (
		<div mix={[demo.row()]}>
			<button mix={[appearance("none")]}>appearance("none")</button>
			<button mix={[appearance("auto")]}>appearance("auto")</button>
		</div>
	),
} satisfies UtilityExampleModule;
