/**
 * A `fit` example that keeps the whole photograph in view, with the striped box showing
 * the space the image leaves empty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bs, fit, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A wide image contained in a square box. */
export default {
	title: "Containing an image",
	description:
		'Use `fit("contain")` to resize an image to fit inside its box, keeping its whole frame visible:',
	render: () => (
		<img src={demo.photoUrl()} alt="" mix={[fit("contain"), is(48), bs(48), demo.track()]} />
	),
} satisfies UtilityExampleModule;
