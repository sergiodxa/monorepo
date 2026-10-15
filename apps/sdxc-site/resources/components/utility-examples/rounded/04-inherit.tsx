/**
 * A `rounded` example that inherits its parent's radius, so a child filling a rounded
 * container follows its corners without restating the step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A child taking its parent's corner radius. */
export default {
	title: "Inheriting the parent's radius",
	description: 'Use `rounded("inherit")` to give an element the same radius as its parent:',
	render: () => (
		<div mix={[rounded("xl"), p(2), bg("brand.tint")]}>
			<div mix={[rounded("inherit"), demo.shape()]}>rounded("inherit")</div>
		</div>
	),
} satisfies UtilityExampleModule;
