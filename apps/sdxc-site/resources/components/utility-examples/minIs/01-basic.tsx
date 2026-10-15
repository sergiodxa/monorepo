/**
 * The opening `minIs` example: buttons sharing one minimum inline size, so short labels
 * line up while a long label still widens its button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { minIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Buttons share a minimum inline size. */
export default {
	title: "Basic example",
	description:
		"Use `minIs(n)` to give an element a minimum inline size, like buttons that stay at least `minIs(32)` wide however short their label:",
	render: () => (
		<div mix={[demo.row()]}>
			<button type="button" mix={[minIs(32), demo.block()]}>
				OK
			</button>
			<button type="button" mix={[minIs(32), demo.block()]}>
				Cancel
			</button>
			<button type="button" mix={[minIs(32), demo.block()]}>
				Save and continue
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
