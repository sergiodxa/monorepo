/**
 * A `fieldSizing` example comparing `"fixed"` with `"content"` on the same value, so a
 * reader sees the platform's default width beside the width the value needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fieldSizing, vstack } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Two inputs holding one value, one at the platform's fixed width and one sized to it. */
export default {
	title: "Keeping the fixed size",
	description:
		'Use `fieldSizing("fixed")` to keep the platform\'s default size whatever the control holds:',
	render: () => (
		<div mix={[vstack({ gap: 4, align: "start" })]}>
			<input value="Hi" mix={[fieldSizing("fixed"), demo.field()]} />
			<input value="Hi" mix={[fieldSizing("content"), demo.field()]} />
		</div>
	),
} satisfies UtilityExampleModule;
