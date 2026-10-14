/**
 * The opening `fieldSizing` example: a text input that grows and shrinks with what is
 * typed into it, with no script measuring the text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fieldSizing } from "@sdxc/u/layout";
import { minIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A text input sized to the value it holds. */
export default {
	title: "Basic example",
	description:
		"Use `fieldSizing()` to size a form control to the value it holds. Type in the field to see it grow:",
	render: () => <input value="Grows as you type" mix={[fieldSizing(), minIs(24), demo.field()]} />,
} satisfies UtilityExampleModule;
