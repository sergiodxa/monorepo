/**
 * A `positionTryFallbacks` example with several fallbacks tried in order: an anchor in a
 * corner, where only the last, combined flip keeps the label inside its container.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	absolute,
	anchorName,
	positionAnchor,
	positionArea,
	positionTryFallbacks,
	relative,
	vstack,
} from "sdxc/u/layout";
import { bs, is, m } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Each fallback is tried in turn until one fits, combined flips included. */
export default {
	title: "Trying several fallbacks",
	description:
		'Pass several fallbacks to try them in order, combining tactics in one entry like `"flip-block flip-inline"`:',
	render: () => (
		<div mix={[relative(), vstack({ align: "end" }), is(72), bs(40), demo.track()]}>
			<div mix={[anchorName("corner"), m(2), demo.block()]}>anchor</div>
			<div
				mix={[
					absolute(),
					positionAnchor("corner"),
					positionArea("top right"),
					positionTryFallbacks("flip-block", "flip-inline", "flip-block flip-inline"),
					demo.block(),
				]}
			>
				flipped twice
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
