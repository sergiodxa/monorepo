/**
 * The `inline` example: a `div` set inline inside a run of text, so it wraps across lines
 * with the words around it instead of breaking the paragraph.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inline } from "sdxc/u/layout";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An inline element flows and wraps with the text around it. */
export default {
	title: "Basic example",
	description:
		"Use `inline()` to make an element flow with the text around it, wrapping across lines like a word does:",
	render: () => (
		<div mix={[is(96), demo.prose()]}>
			When controlling the flow of text, an element set to{" "}
			<div mix={[inline(), demo.box()]}>inline() wraps across lines like the words around it</div>{" "}
			instead of starting a block of its own.
		</div>
	),
} satisfies UtilityExampleModule;
