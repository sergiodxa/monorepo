/**
 * A `focusVisible` example on a text field, which the browser marks as visibly focused
 * for both the mouse and the keyboard, so the reader sees the ring a field always earns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, outline } from "sdxc/u/color";
import { focusVisible } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A field whose border and ring switch to the brand tone while the caret is in it. */
export default {
	title: "Focusing a field",
	description:
		"Text fields match `focusVisible()` however they were focused. Click or tab into the field:",
	render: () => (
		<input
			type="text"
			placeholder="Your name"
			mix={[
				border("neutral.border"),
				outline("none"),
				focusVisible([border("brand.strong"), outline({ color: "brand", width: 2, offset: 1 })]),
				demo.input(),
			]}
		/>
	),
} satisfies UtilityExampleModule;
