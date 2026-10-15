/**
 * The opening `fit` example: a wide photograph in a square box, cropped to cover it,
 * which is also what the call does with no argument.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bs, fit, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A wide image covering a square box. */
export default {
	title: "Basic example",
	description:
		'Use `fit("cover")`, or `fit()` with no argument, to resize an image to cover its box, cropping whatever overflows:',
	render: () => (
		<img src={demo.photoUrl()} alt="" mix={[fit("cover"), is(48), bs(48), demo.track()]} />
	),
} satisfies UtilityExampleModule;
