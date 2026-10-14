/**
 * The opening `touchAction` example: three scrollable photos that each allow a different
 * touch gesture, for a reader on a touch screen to pan one by one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "@sdxc/u/effects";
import { touchAction } from "@sdxc/u/general";
import { overflow } from "@sdxc/u/overflow";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Scrollable photos that pan freely, only sideways, and not at all. */
export default {
	title: "Basic example",
	description:
		'Use `touchAction(value)` to choose which touch gestures the browser handles on an element, like `touchAction("pan-x")` for sideways panning only. On a touch screen, try panning each photo:',
	render: () => (
		<div mix={[demo.row()]}>
			<div>
				<p mix={[demo.caption()]}>touchAction("auto")</p>
				<div mix={[touchAction("auto"), overflow("auto"), is(40), bs(32), rounded("lg")]}>
					<div mix={[is(80), bs(64), demo.photo()]} />
				</div>
			</div>
			<div>
				<p mix={[demo.caption()]}>touchAction("pan-x")</p>
				<div mix={[touchAction("pan-x"), overflow("auto"), is(40), bs(32), rounded("lg")]}>
					<div mix={[is(80), bs(64), demo.photo()]} />
				</div>
			</div>
			<div>
				<p mix={[demo.caption()]}>touchAction()</p>
				<div mix={[touchAction(), overflow("auto"), is(40), bs(32), rounded("lg")]}>
					<div mix={[is(80), bs(64), demo.photo()]} />
				</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
