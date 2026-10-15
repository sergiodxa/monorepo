/**
 * A `media` example on the pointer, so buttons grow their hit area on a touch screen, a
 * device feature no container query can see.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { media } from "@sdxc/u/responsive";
import { minBs, minIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Larger targets for a coarse pointer. */
export default {
	title: "Querying a device feature",
	description:
		'Query a device feature, like `media("(pointer: coarse)", ...)`, to give touch screens larger targets. Open the page on a phone, or emulate touch in your browser\'s dev tools:',
	render: () => (
		<div mix={[demo.row()]}>
			<button
				type="button"
				mix={[
					bg("brand.solid"),
					fg("brand.onSolid"),
					media("(pointer: coarse)", [minBs(11), minIs(11)]),
					demo.control(),
				]}
			>
				Like
			</button>
			<button
				type="button"
				mix={[
					bg("neutral.tint"),
					fg("neutral.emphasis"),
					media("(pointer: coarse)", [minBs(11), minIs(11)]),
					demo.control(),
				]}
			>
				Share
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
