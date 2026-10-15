/**
 * A `fit` example that stretches the photograph to its box, which distorts it, so the
 * reader sees what the other values protect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bs, fit, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A wide image stretched to a square box. */
export default {
	title: "Stretching to fit",
	description: 'Use `fit("fill")` to stretch an image to its box, ignoring its aspect ratio:',
	render: () => (
		<img src={demo.photoUrl()} alt="" mix={[fit("fill"), is(48), bs(48), demo.track()]} />
	),
} satisfies UtilityExampleModule;
