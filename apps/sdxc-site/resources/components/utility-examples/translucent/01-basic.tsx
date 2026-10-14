/**
 * The opening `translucent` example: a panel over a photograph, with a backdrop blur
 * that applies only while the reader has not asked for reduced transparency.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { translucent } from "@sdxc/u/color";
import { p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A blurred panel over a photograph. */
export default {
	title: "Basic example",
	description:
		"Use `translucent()` for a panel that blurs what is behind it, falling back to a solid background when the reader prefers reduced transparency:",
	render: () => (
		<div mix={[p(8), demo.photo()]}>
			<div mix={[translucent(), demo.swatch()]}>translucent()</div>
		</div>
	),
} satisfies UtilityExampleModule;
