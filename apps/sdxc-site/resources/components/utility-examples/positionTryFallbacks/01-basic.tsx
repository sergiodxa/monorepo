/**
 * The opening `positionTryFallbacks` example: the same tooltip twice, once with room
 * above its anchor and once without, where it flips below instead of overflowing.
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
} from "@sdxc/u/layout";
import { bs, is, m, mb } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A fallback replaces the preferred position when that one would overflow. */
export default {
	title: "Basic example",
	description:
		'Use `positionTryFallbacks()` to list positions to try when the preferred one overflows, like `"flip-block"` to move a tooltip below an anchor with no room above it:',
	render: () => (
		<div mix={[demo.row()]}>
			<div
				mix={[
					relative(),
					vstack({ align: "center", justify: "end" }),
					is(48),
					bs(36),
					demo.track(),
				]}
			>
				<div mix={[anchorName("low"), mb(4), demo.block()]}>room above</div>
				<div
					mix={[
						absolute(),
						positionAnchor("low"),
						positionArea("top"),
						positionTryFallbacks("flip-block"),
						m(1),
						demo.block(),
					]}
				>
					tooltip
				</div>
			</div>
			<div
				mix={[
					relative(),
					vstack({ align: "center", justify: "start" }),
					is(48),
					bs(36),
					demo.track(),
				]}
			>
				<div mix={[anchorName("high"), mb(4), demo.block()]}>no room above</div>
				<div
					mix={[
						absolute(),
						positionAnchor("high"),
						positionArea("top"),
						positionTryFallbacks("flip-block"),
						m(1),
						demo.block(),
					]}
				>
					tooltip
				</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
